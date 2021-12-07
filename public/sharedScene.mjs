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
            case 'map':                
                let length = 0;
                while (content.props[length] !== undefined) {length++}

                if (length == 0) return [];

                const first = navigateToContents(content.props, 0);
                
                const array = first.datatype === 'int' ? new Int32Array(length) : new Float32Array(length);
                for (let i = 0; i < length; i++)
                    array[i] = navigateToContents(content.props, i).value;

                return array;
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

    handleSyncMessage(syncMessage, senderID) {
        const patch = this.merger.handleSyncMessage(syncMessage, senderID);

        const reply = this.merger.makeSyncMessage(senderID);       

        if (!this.initialSyncCompleted) {
            const doc = this.merger.getDocument();            

            if (!reply) {
                // We're up to date!
                console.log('Completed first sync.')
                console.log(doc);
                this.initialSyncCompleted = true;               

                if (!doc.objects) {
                    console.log('document is empty - populating data structures');
                    this.merger.applyChange("initial scene content", doc => {
                        doc.objects = new Automerge.Table();
                        doc.geometries = new Automerge.Table();
                        doc.materials = new Automerge.Table();                        
                    });

                    this.merger.applyChange("scene root", doc => {
                        this.sceneRoot.userData.mergeId= doc.objects.add({
                            name: "root",
                            parent: null,
                            position: null,
                            quaternion: null,
                            scale: null,
                            geometry: null,
                            material: null
                        });
                    });                    

                    console.log("created scene: " + this.sceneRoot.userData.mergeId);
                } else {
                    if (doc.objects) {
                        const roots = doc.objects.filter(obj => { return obj.name === "root"});
                        if (roots && roots.length > 0) {
                            const id = roots[0].id;
                            console.log("found scene root", roots[0]);
                            this.sceneObjects.add(id, this.sceneRoot);
                        } else {
                            console.log("no scene root found!");
                        }
                    }
                }

                console.log("INITIAL DOC: ",this.merger.getDocument());
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
        
        const geoChanges = checkTableForChanges(patch, 'geometries');        
        if (geoChanges) {
            for (let key of Object.keys(geoChanges)) {
                if (!this.sceneGeometries[key]) {
                    const data = navigateToContents(geoChanges, key);
                    console.log("outer data", geoChanges[key],"inner data: ", data);
                    const geo = new THREE.BufferGeometry();
                    geo.name = getPropertyValue(data, 'name');
                    const pos = getPropertyValue(data, 'position');
                    const index = getPropertyValue(data, 'index');
                    
                    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                    geo.setIndex(new THREE.BufferAttribute(index));

                    console.log("Received new geometry", geo.name, key);
                    
                    this.sceneGeometries.add(key, geo);
                } // TODO: else case - handle a change to an existing key.
            }
        }

        const matChanges = checkTableForChanges(patch, 'materials');        
        if (matChanges) {
            for (let key of Object.keys(matChanges)) {
                if (!this.sceneGeometries[key]) {
                    const data = navigateToContents(matChanges, key);
                    // TODO: read material type / colour info to reproduce it more accurately.
                    const mat = new THREE.MeshLambertMaterial();
                    mat.name = getPropertyValue(data, 'name');                  

                    console.log("Received new material", mat.name, key);                    
                    this.sceneMaterials.add(key, mat);
                } // TODO: else case - handle a change to an existing key.
            }
        }
        
    }

    fakeUpdate() {
        const geoName = "box-111";
        let geo = this.sceneGeometries.getByName(geoName);
        if (!geo) {
            geo = new THREE.BoxGeometry(1, 1, 1);
            geo.name = geoName;
            this.registerGeometry(geo);
            console.log("Geometry not found - making a new one: ", geo.userData.mergeId);
        }

        const matName = "default material";        
        let mat = this.sceneMaterials.getByName(matName);
        if (!mat) {
            mat = new THREE.MeshLambertMaterial();
            mat.name = matName;
            this.registerMaterial(mat);
            console.log("Material not found - making a new one: ", mat.userData.mergeId);
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = "test" + Math.floor(Math.random() * 1000);
        mesh.position.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
        this.sceneRoot.add(mesh);
        this.registerMesh(mesh);

        console.log("MODIFIED DOC: ",this.merger.getDocument());
        console.log("added test mesh " + mesh.name);
        console.log("added test geo " + geo.userData.mergeId);
        console.log("added test mat " + mat.userData.mergeId);
    }

    tryGenerateSyncMessage() {
        return this.merger.makeSyncMessage(this.serverID);        
    }
}

export { SharedScene }