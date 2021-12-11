import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';

function checkTableForChanges(patch, tableName) {
    const changes = patch.diffs.props[tableName];
    if (!changes) return null;

    for (let key of Object.keys(changes)) {
        if (key !== 'type') {
            return changes[key].props;
        }
    }
    return null;
}

function getPropertyValue(node, propertyName) {
    const subNode = node.props[propertyName];
    if (!subNode) return undefined;
    for (let content of Object.values(subNode)) {
        if (!content) continue;
        switch (content.type) {
            case 'value': return content.value;
            case 'map': {
                let length = 0;
                while (content.props[length] !== undefined) {length++}

                if (length == 0) return [];

                const first = navigateToContents(content.props, 0);
                
                const array = first.datatype === 'int' ? [] : new Float32Array(length);
                for (let i = 0; i < length; i++)
                    array[i] = navigateToContents(content.props, i).value;

                return array;
            }
            case 'list': {
                const array = [];                
                for (const entry of content.edits) {
                    switch (entry.action) {
                        case 'multi-insert':
                            array.splice(entry.index, 0, ...entry.values);
                            break;
                        case 'insert':
                            array.splice(entry.index, 0, entry.value.value);
                            break;
                        case 'update':
                            array[entry.index] = entry.value.value;
                            break;
                    }
                }
                //console.log(propertyName + ":", array);
                return array;
            }
        }
            
    }
    return undefined;
}



function navigateToContents(data, key) {
    const container = data[key];    
    return Object.values(container)[0];
}

class ObjectCache {

    add(id, thing) {
        this[id] = thing;
        thing.userData.mergeId = id;
        // console.log("Added object to cache", id, thing);
    }

    getByName(name) {
        for (let value of Object.values(this))
            if (value && value.name === name)
                return value;
        return null;
    }

    remove(id) {
        this[id] = undefined;
        // TODO: Evaluate "delete this[id]" - may cause JIT to take slow path.
    }
}

const arrayMemberNames = [
    'x','y','z','w'
];

function tryUpdateTuple(tuple, data, propertyName) {
    const edit = getPropertyValue(data, propertyName);
    if (!edit) return false;
    for (let i = 0; i < 4; i++) {
        if (typeof(edit[i]) === 'number')
            tuple[arrayMemberNames[i]] = edit[i];
    }
    return true;
}

class SharedScene {

    sceneRoot = null;
    sceneObjects = new ObjectCache();
    sceneGeometries = new ObjectCache();
    sceneMaterials = new ObjectCache();

    serverID;
    merger;

    initialSyncCompleted = false;

    constructor(parentScene, myID, serverID) {
        console.log("setting up SharedScene", myID, serverID);
        this.serverID = serverID;
        this.merger = setupMerge(null, myID);
        this.merger.addClient(serverID);

        this.sceneRoot = new THREE.Scene();
        parentScene.add(this.sceneRoot);
    }

    moveObject(object3D, position) {
        object3D.position.copy(position);

        this.merger.applyChange("move object " + object3D.name, doc => {
            const db = doc.objects.byId(object3D.userData.mergeId);
            db.position[0] = position.x;
            db.position[1] = position.y;
            db.position[2] = position.z;
        });
    }

    rotateObject(object3D, quaternion) {
        object3D.quaternion.copy(quaternion);

        this.merger.applyChange("rotate object " + object3D.name, doc => {
            const db = doc.objects.byId(object3D.userData.mergeId);
            db.quaternion[0] = quaternion.x;
            db.quaternion[1] = quaternion.y;
            db.quaternion[2] = quaternion.z;
            db.quaternion[3] = quaternion.w;
        });
    }

    scaleObject(object3D, scale) {
        object3D.scale.copy(scale);

        this.merger.applyChange("scale object " + object3D.name, doc => {
            const db = doc.objects.byId(object3D.userData.mergeId);
            db.scale[0] = scale.x;
            db.scale[1] = scale.y;
            db.scale[2] = scale.z;
        });
    }

    placeInParent(child, parent) {
        const childId = child.userData.mergeId;          
        const parentId = parent ? parent.userData.mergeId : null;

        this.merger.applyChange("parenting", doc => {
            const childRow = doc.objects.byId(childId);
            childRow.parentId = parentId;
        })

        if (parent) {
            parent.addChild(child);            
        } else if (child.parent) {
            child.removeFromParent();
        }
    }

    dbFromObject(object3D) {
        return {
            name: object3D.name,
            parent: object3D.parent?.userData.mergeId,
            position: [object3D.position.x, object3D.position.y, object3D.position.z],
            quaternion: [object3D.quaternion.x, object3D.quaternion.y, object3D.quaternion.z, object3D.quaternion.w],
            scale: [object3D.scale.x, object3D.scale.y, object3D.scale.z]
        };
    }

    registerMesh(mesh) {
        this.merger.applyChange("new mesh " + mesh.name, doc => {
            const entry = this.dbFromObject(mesh);
            entry.geometry = mesh.geometry.userData.mergeId;
            entry.material = mesh.material.userData.mergeId;
            const id = doc.objects.add(entry);
            this.sceneObjects.add(id, mesh);
        });
    }

    registerGeometry(geo) {
        this.merger.applyChange("new geometry " + geo.name, doc => {
            const id = doc.geometries.add({
                name: geo.name,
                index: geo.index.array,
                position: geo.getAttribute('position').array
            });
            this.sceneGeometries.add(id, geo);
        })
    }

    registerMaterial(mat) {
        this.merger.applyChange("new material " + mat.name, doc => {
            // TODO: store more complete material description to handle more types of materials.
            const id = doc.materials.add({
                name: mat.name,
                type: typeof(mat),
                color: [mat.color.r, mat.color.g, mat.color.b],                
            });
            this.sceneMaterials.add(id, mat);
        })
    }

    updateTransformation(sceneObject) {
        this.merger.applyChange("transform " + sceneObject.name, doc => {
            const row = doc.objects.byId(sceneObject.userData.mergeId);
            row.position[0] = sceneObject.position.x;
            row.position[1] = sceneObject.position.y;
            row.position[2] = sceneObject.position.z;

            row.quaternion[0] = sceneObject.quaternion.x;
            row.quaternion[1] = sceneObject.quaternion.y;
            row.quaternion[2] = sceneObject.quaternion.z;
            row.quaternion[3] = sceneObject.quaternion.w;

            row.scale[0] = sceneObject.scale.x;
            row.scale[1] = sceneObject.scale.y;
            row.scale[2] = sceneObject.scale.z;
        });
    }

    handleSyncMessage(syncMessage, senderID) {
        const patch = this.merger.handleSyncMessage(syncMessage, senderID);

        const reply = this.merger.makeSyncMessage(senderID);       

        if (!this.initialSyncCompleted) {
            const doc = this.merger.getDocument();            

            if (!reply) {
                // We're up to date!
                console.log('Completed first sync.')
                this.initialSyncCompleted = true;               

                if (!doc.objects) {
                    this.merger.applyChange("initial scene content", doc => {
                        doc.objects = new Automerge.Table();
                        doc.geometries = new Automerge.Table();
                        doc.materials = new Automerge.Table();                        
                    });

                    this.merger.applyChange("scene root", doc => {
                        const rootKey = doc.objects.add({
                            name: "root",
                            parent: null,
                            position: null,
                            quaternion: null,
                            scale: null,
                            geometry: null,
                            material: null
                        });

                        this.sceneObjects.add(rootKey, this.sceneRoot);
                    });                    

                    console.log("Document was empty - created initial scene: " + this.sceneRoot.userData.mergeId);
                } 

                //console.log("INITIAL DOC: ",this.merger.getDocument());
                setTimeout(()=> this.fakeUpdate(), 1000);
            }
        }

        // If there were remote changes, parse the changes.
        if (patch) {
            this.parsePatch(patch);
        }

        return reply;
    }

    parsePatch(patch) {
        //console.log("Processing patch ", patch);     
        const geoChanges = checkTableForChanges(patch, 'geometries');        
        if (geoChanges) {
            for (let key of Object.keys(geoChanges)) {
                if (!this.sceneGeometries[key]) {
                    const data = navigateToContents(geoChanges, key);                    
                    const geo = new THREE.BufferGeometry();
                    geo.name = getPropertyValue(data, 'name');
                    const pos = getPropertyValue(data, 'position');
                    const index = getPropertyValue(data, 'index');
                    
                    geo.setIndex(index);
                    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));                    
                    geo.computeVertexNormals();

                    //console.log("Received new geometry", geo.name, key);                    
                    
                    this.sceneGeometries.add(key, geo);

                } // TODO: else case - handle a change to an existing key.
            }
        }

        const matChanges = checkTableForChanges(patch, 'materials');        
        if (matChanges) {
            for (let key of Object.keys(matChanges)) {
                if (!this.sceneMaterials[key]) {
                    const data = navigateToContents(matChanges, key);
                    // TODO: read material type / colour info to reproduce it more accurately.
                    const mat = new THREE.MeshLambertMaterial();
                    mat.name = getPropertyValue(data, 'name');                  

                    //console.log("Received new material", mat.name, key);                    
                    this.sceneMaterials.add(key, mat);

                } // TODO: else case - handle a change to an existing key.
            }
        }

        const objectChanges = checkTableForChanges(patch, 'objects');
        const parentingQueue = [];
        if (objectChanges) {
            for (let key of Object.keys(objectChanges)) {
                const data = navigateToContents(objectChanges, key);
                //console.log(key, "Object data: ",  data);
                const sceneObject = this.sceneObjects[key];
                if (!sceneObject) {
                    // New object we've never seen before!                    
                    const pos = getPropertyValue(data, 'position');
                    if (pos === null && !this.sceneRoot.userData.mergeId) {
                        // Found scene root for the first time - it's the only one allowed to have a null position.
                        this.sceneObjects.add(key, this.sceneRoot);
                        //console.log("Received scene root:", key);
                        continue;
                    }
                    
                    // TODO: Support types *other* than meshes.
                    const geo = this.sceneGeometries[getPropertyValue(data, 'geometry')];
                    const mat = this.sceneMaterials[getPropertyValue(data, 'material')];

                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.name = getPropertyValue(data, 'name');

                    mesh.position.set(pos[0], pos[1], pos[2]);

                    const quat = getPropertyValue(data, 'quaternion');
                    mesh.quaternion.set(quat[0], quat[1], quat[2], quat[3]);

                    const scale = getPropertyValue(data, 'scale');
                    mesh.scale.set(scale[0], scale[1], scale[2]);

                    const parentID = getPropertyValue(data, 'parent');
                    if (parentID) {
                        // We might not have loaded the parent yet, so queue this change to handle at the end.
                        parentingQueue.push({child: mesh, parentKey: parentID});
                    }
                    this.sceneObjects.add(key, mesh);
                    //console.log(`New object ${mesh.name}/${key} at `, pos, quat, geo.name, mat.name);                    
                } else {                    
                    if (tryUpdateTuple(sceneObject.position, data, 'position')) {
                        //console.log("...moved to", sceneObject.position);
                    }
                    if (tryUpdateTuple(sceneObject.quaternion, data, 'quaternion')) { 
                        //console.log("...rotated to", sceneObject.quaternion);
                    }
                    if (tryUpdateTuple(sceneObject.scale, data, 'scale')) {
                        //console.log("...scaled to", sceneObject.scale);
                    }
                }
            }
        }
        
        // Once we've loaded all objects in this patch, wire up parent relationships.
        for (let item of parentingQueue) {
            const parent = this.sceneObjects[item.parentKey];
            parent.add(item.child);
        }

        //console.log("Scene after patch: ", this.sceneRoot.toJSON());
    }

    fakeUpdate() {
        const geoName = "box-111";
        let geo = null; //this.sceneGeometries.getByName(geoName);
        if (!geo) {
            geo = new THREE.BoxGeometry(1, 1, 1);      
            geo.name = geoName;
            this.registerGeometry(geo);
            //console.log("Geometry not found - making a new one: ", geo.userData.mergeId);
        }

        const matName = "default material";        
        let mat = this.sceneMaterials.getByName(matName);
        if (!mat) {
            mat = new THREE.MeshLambertMaterial();
            mat.name = matName;
            this.registerMaterial(mat);
            //console.log("Material not found - making a new one: ", mat.userData.mergeId);
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = "test" + Math.floor(Math.random() * 1000);
        mesh.position.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
        this.sceneRoot.add(mesh);
        this.registerMesh(mesh);

        //console.log("MODIFIED DOC: ",this.merger.getDocument());
        //console.log("added test mesh", mesh.name, mesh.userData.mergeId);
        //console.log("added test geo " + geo.userData.mergeId);
        //console.log("added test mat " + mat.userData.mergeId);

        function fakeFollowUp() {
            mesh.position.x += 5;
            mesh.quaternion.set(0, 0.6,	0.5, 0.6244998);
            mesh.scale.z = 2;

            //console.log("Moved to ", mesh.position);
            this.updateTransformation(mesh);
        }

        setTimeout(fakeFollowUp.bind(this), 1000);
    }

    tryGenerateSyncMessage() {
        return this.merger.makeSyncMessage(this.serverID);        
    }
}

export { SharedScene }