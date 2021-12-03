import * as THREE from 'https://cdn.skypack.dev/three@0.126.0/build/three.module.js';

class SharedScene {

    sceneRoot;
    sceneObjects;
    serverID;

    merger;

    initialSyncCompleted = false;

    constructor(parentScene, myID, serverID) {
        this.serverID = serverID;
        this.merger = setupMerge(null, myID);
        this.merger.addClient(serverID);

        this.sceneRoot = new THREE.Scene();
        parentScene.add(this.sceneRoot);
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
        this.merger.applyChange("new mesh", doc => {
            const entry = this.dbFromObject(mesh);
            mesh.geometry = mesh.geometry.userData.mergeId;
            mesh.userData.mergeId = doc.add(entry);
        });
    }

    registerGeometry(geo) {
        this.merger.applyChange("new geo", doc => {
            geo.userData.mergeId = doc.geometries.add({
                indices: geo.index.array,
                position: geo.getAttribute('position').array
            });
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
                            this.sceneRoot.userData.mergeId = roots[0].id;
                            console.log("found scene root", roots[0]);
                        } else {
                            console.log("no scene root found!");
                        }
                    }
                }

                console.log("INITIAL DOC: ",this.merger.getDocument());
                setTimeout(()=> this.fakeUpdate(), 1000);
            }
        }

        if (this.sceneRoot.userData.mergeId) {
            // TODO: parse patch.
        }

        return reply;
    }

    fakeUpdate() {
        console.log("adding fake data " + this.sceneRoot.userData.mergeId);
        this.merger.applyChange("adding fake object", doc => {
            this.fakeDataID = doc.objects.add({
                name: "fake" + Math.floor(Math.random() * 1000), 
                parent: this.sceneRoot.userData.mergeId,
                position: [1, 2, 3],
                quaternion: [0, 0, 0, 1],
                scale: [1, 1, 1],
                geometry: null,
                material: null
            })
        })

        console.log("MODIFIED DOC: ",this.merger.getDocument());
        console.log("added fake object " + this.fakeDataID);
    }

    tryGenerateSyncMessage() {
        return this.merger.makeSyncMessage(this.serverID);        
    }
}

export { SharedScene }