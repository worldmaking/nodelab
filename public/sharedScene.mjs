import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';

/*
USAGE GUIDANCE

 When connecting to the server, create a
 let shared = new SharedScene(world.scene, myID, serverID)
 passing it the unique IDs sent from the server. These will be used to track who is responsible for each scene change.

 To add a new mesh to the scene, do something like the following:

 // This pattern will re-use the same geometry if a matching one was already created in this shared scene.
 const geoName = "My Awesome Box";
 let geo = shared.sceneGeometries.getByName(geoName);
 if (!geo) {
    // We're the first to create the geometry! Make it.
    geo = new THREE.BoxGeometry(1, 2, 3);
    geo.name = geoName
 }

 // Same re-use pattern for materials.
 const matName = "My Awesome Blue";
 let mat = shared.sceneMaterials.getByName(matName);
 if (!mat) {
    mat = new THREE.MeshLambertMaterial({color: 0x0000FF});
    mat.name = matName;
 }

 const mesh = new THREE.Mesh(geo, mat);
 mesh.name = "My Awesome Mesh"; // Consider adding a unique ID / serial number here.

 // Add the object to a parent already part of the shared scene - like the root.
 shared.sceneRoot.add(mesh);

 // This will add the mesh to the shared document - along with its dependencies.
 shared.registerMesh(mesh);

 To share local transformation or parenting changes to these objects, call shared.updateTransformation(mesh) or shared.placeInParent(mesh, newParentOrNull).
 To delete an object from the shared scene, call shared.remove(mesh) - this also handles removing it from the THREE.js scene too.


 During the animation loop, call shared.tryGenerateSyncMessage() to see if we have any recent local changes to send to the server.

 When a sync message is received, call shared.handleSyncMessage(message, sender) - this will return the SyncMessage to send in reply, if any.
 */


//#region Helper Methods

/**
 * Helper function to check a Patch for changes to a specific named table.
 * @param {import('automerge').Patch} patch Patch data to search.
 * @param {string} tableName Name of the table to check for changes.
 * @returns {Object|null} "Props" object containing changes made to this table, or null if no changes were found.
 */
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

/**
 * Helper function to navigate to the next named property inside a Patch data node.
 * (Automerge gives these cryptic one-off names, so it helps to have a function to shortcut to them)
 * @param {Object} data Data object to navigate into.
 * @param {string} key Name of the property whose contents we want to access.
 * @returns {Object} The value of the first named property inside the named property we're inspecting.
 */
 function navigateToContents(data, key) {
    const container = data[key];    
    return Object.values(container)[0];
}

/**
 * Helper function for parsing changes made to objects from an Automerge Patch.
 * @param {Object} node Patch node corresponding to a given table row.
 * @param {string} propertyName Name of the property to fetch.
 * @returns {*} Data object representing the updated value of this property, or null if none were found.
 */
function getPropertyValue(node, propertyName) {
    // Navigate to the child node containing this property's changes.
    const subNode = node.props[propertyName];

    // Abort if no changes to this named property were found.
    if (!subNode) return null;


    // Iterate over the members of this property.
    for (let content of Object.values(subNode)) {
        if (!content) continue;
        switch (content.type) {
            // Value type changes can be fetched directly.
            case 'value': return content.value;

            // Map type changes are used for certain (large) array types.
            case 'map': {
                // Determine the length of the array being stored this way by scanning to the end.
                let length = 0;
                while (content.props[length] !== undefined) {length++}

                // Return an empty array if no contents of the map were found.
                if (length == 0) return [];

                // Navigate to the data payload of the first entry in the array,
                // and use this to deduce the data type we're working with.
                const first = navigateToContents(content.props, 0);                
                const array = first.datatype === 'int' ? [] : new Float32Array(length);
                // Integer arrays should be stored in a conventional JavaScript array, to work as Geometry indices.
                // Float data should be stored in a Float32Array to work for vertex position/normal/texture coordinate attributes.

                // Extract the data content of each entry of the map into the array and return it.
                for (let i = 0; i < length; i++)
                    array[i] = navigateToContents(content.props, i).value;

                return array;
            }

            // List type changes are used for object position/quaternion/scale.
            case 'list': {                
                // Build an empty array, and add onto it as we walk the edits collection.
                const array = [];

                // Sometimes several edits are sent in one batch, so we need to process each one sequentially.
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
                
                return array;
            }
        }            
    }

    // If we got here, we did not recognize the type of changes reported.
    return null;
}


// Class for storing references to objects with their Automerge IDs for ease of lookup.
class ObjectCache {

    /**
     * Add an item to the cache with a given ID, and record that ID in the item's UserData.
     * @param {string} id Unique Automerge ID for this data item.
     * @param {THREE.Object3D|THREE.BufferGeometry|THREE.Material} thing Data object to be cached.
     */
    add(id, thing) {
        this[id] = thing;
        thing.userData.mergeId = id;
    }

    /**
     * Find the first contained data object with a specific name (in some arbitrary order), and return it.
     * @param {string} name Name to search for.
     * @returns {THREE.Object3D|THREE.BufferGeometry|THREE.Material|null} Cached object, or null if none with that name were found. 
     */
    getByName(name) {
        for (let value of Object.values(this))
            if (value && value.name === name)
                return value;
        return null;
    }

    /**
     * Removes an item with a given unique ID from the cache.
     * @param {string} id Unique Automerge ID for the data item to remove.
     */
    remove(id) {
        this[id] = undefined;
        // TODO: Evaluate "delete this[id]" - may cause JIT to take slow path.
    }
}

// Quick hack to make it easy to update Vector3 values and Quaternions with the same function.
const arrayMemberNames = ['x','y','z','w'];

/**
 * Helper function to apply value changes from Automerge to a position, scale, or quaternion property.
 * @param {THREE.Vector3|THREE.Quaternion} tuple Property to be updated.
 * @param {Object} data Data object containing the property changes we want to use for this update.
 * @param {string} propertyName Name of the property to look up in the patch data.
 * @returns {Boolean} True if changes were made, false otherwise.
 */
function tryUpdateTuple(tuple, data, propertyName) {
    const edit = getPropertyValue(data, propertyName);
    if (!edit) return false;
    for (let i = 0; i < 4; i++) {
        if (typeof(edit[i]) === 'number')
            tuple[arrayMemberNames[i]] = edit[i];
    }
    return true;
}

//#endregion

// Maintains a shared scene object that can be synchronized via Automerge.
// Used only on client side - server only knows about the Automerge document, not its interpretation as a THREE.Scene.
class SharedScene {

    /** @type {THREE.Scene} Root object for the scene being synchronized. */
    sceneRoot = null;

    /** @type {ObjectCache} Containing the scene root and THREE.Object3D contents of the shared scene. */
    sceneObjects = new ObjectCache();

    /** @type {ObjectCache} Containing BufferGeometry instances used in the scene. */
    sceneGeometries = new ObjectCache();

    /** @type {ObjectCache} Containing Material instances used in the scene. */
    sceneMaterials = new ObjectCache();

    /** @type {string} Unique ID representing the server we're communicating with. */
    serverID;

    /** @type {Merger} Wrapper for the synchronized automerge document. */
    merger;

    /** @type {Boolean} Tracks whether we've caught up to the remote document when first connecting. */
    initialSyncCompleted = false;

    /** @type {OnSceneObjectChange} Callback to invoke immediately after new objects are added to the shared scene - locally or via remote action. */
    onSceneObjectAdded;
    /** @type {OnSceneObjectChange} Callback to invoke just before objects are removed from the shared scene - locally or via remote action. */
    onSceneObjectRemoved;

    /**
     * Set up a shared scene, as a child of a given parent scene, with automerge IDs to use.
     * @param {THREE.Scene} parentScene Local scene object that should contain the shared scene.
     * @param {string} myID Unique ID to represent "this" actor in the shared document's change log - assigned by server.
     * @param {string} serverID Unique ID representing the server - also provided by server during handshake.
     */
    constructor(parentScene, myID, serverID) {
        console.log("setting up SharedScene", myID, serverID);
        this.serverID = serverID;

        // Create Automerge document and set it up for communication between us and the server.
        this.merger = new Merger(null, myID);
        this.merger.addClient(serverID);

        // Create the shared scene and attach it to the parent scene.
        this.sceneRoot = new THREE.Scene();
        parentScene.add(this.sceneRoot);
    }

    /**
     * Prepare a local mesh object to be shared with others.
     * @param {THREE.Mesh} mesh Mesh object to share.
     */
    registerMesh(mesh) {

        // Add anything the mesh depends on into the shared scene document,
        // if it's not there already.
        if (!mesh.geometry.userData.mergeId) {
            this.registerGeometry(mesh.geometry);
        }

        if (!mesh.material.userData.mergeId) {
            this.registerMaterial(mesh.material);
        }

        // Record the new mesh in the shared objects table, and record its unique ID in our cache.
        this.merger.applyChange("new mesh " + mesh.name, doc => {
            const entry = this.dbFromObject(mesh);
            entry.geometry = mesh.geometry.userData.mergeId;
            entry.material = mesh.material.userData.mergeId;
            const id = doc.objects.add(entry);
            this.sceneObjects.add(id, mesh);
        });

        // Invoke the callback, if one has been set up.
        if (this.onSceneObjectAdded)
            this.onSceneObjectAdded(mesh);
    }

    /**
     * Prepare a local geometry data structure to be shared with others.
     * @param {THREE.BufferGeometry} geo Geometry object to share.
     */
    registerGeometry(geo) {
        // Record the new geometry in the shared geometries table, and record its unique ID in our cache.
        this.merger.applyChange("new geometry " + geo.name, doc => {
            const id = doc.geometries.add({
                name: geo.name,
                index: geo.index.array,
                position: geo.getAttribute('position').array
                // TODO: Encode other geometry properties like normals, texture coordinates, etc.
            });
            this.sceneGeometries.add(id, geo);
        })
    }

    /**
     * Prepare a local material to be shared with others.
     * @param {THREE.Material} mat Material to be shared.
     */
    registerMaterial(mat) {
        // Record the new geometry in the shared materials table, and record its unique ID in our cache.
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

    /**
     * Record any changes to an object's position, orientation, or scale into its shared representation.
     * @param {THREE.Object3D} sceneObject 
     */
    updateTransformation(sceneObject) {       
        // Automerge seems to correctly handle working out which properties were actually changed,
        // versus which ones kept the same value, so it suffices to update everything.
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

    /**
     * Re-parent an object in the shared scene.
     * @param {THREE.Object3D} child Child object.
     * @param {THREE.Object3D|null} parent Parent object, or null to remove it from all parents.
     */
    placeInParent(child, parent) {
        const childId = child.userData.mergeId;          
        const parentId = parent ? parent.userData.mergeId : null;

        // Update the nesting order in the shared objects table.
        this.merger.applyChange("parenting " + child.name, doc => {
            const childRow = doc.objects.byId(childId);
            childRow.parentId = parentId;
        })

        // Reflect this change in the local scene too.
        if (parent) {
            parent.addChild(child);            
        } else if (child.parent) {
            child.parent.remove(child);
        }
    }

    /**
     * Delete an object from the shared scene.
     * @param {THREE.Object3D} sceneObject Object to be removed.
     */
    remove(sceneObject) {
        // Delete this object's row from the objects table. (Replaces it with an empty object {})
        this.merger.applyChange("remove " + sceneObject.name, doc => {
            doc.objects.remove(sceneObject.userData.mergeId);
        });

        // Invoke the callback while the object is still connected to the local scene,
        // in case a listener wants to know what parent had contained the removed object.
        if (this.onSceneObjectRemoved) {
            this.onSceneObjectRemoved(sceneObject);
        }
        
        // Remove it from its parent object, if any.
        if (sceneObject.parent)
            sceneObject.parent.remove(sceneObject);

        // Remove it from our ID cache too, so the garbage collector can claim it.
        this.sceneObjects.remove(sceneObject.userData.mergeId);
    }

    /**
     * Apply a received syncrhonization message to the local copy of the shared scene, and generate the needed reply.
     * @param {string} syncMessage Automerge SyncMessage, as a string like "[0, 255, 128, ...]"
     * @param {string} senderID Unique ID of the actor who sent the message.
     * @returns {import('automerge').SyncMessage|null} Reply to send back to the sender, or null if no reply is needed.
     */
    handleSyncMessage(syncMessage, senderID) {
        // Apply the message to our local copy of the shared document, and record what changed in "patch".
        const patch = this.merger.handleSyncMessage(syncMessage, senderID);

        // Check to see whether we need to reply to ask for follow-up info.
        const reply = this.merger.makeSyncMessage(senderID);       


        if (!this.initialSyncCompleted) {
                 

            if (!reply) {
                // We're up to date!
                console.log('Completed first sync.');
                
                this.initialSyncCompleted = true;               

                // Check to see whether the document contains the initial template structure.                
                const doc = this.merger.getDocument();       
                
                if (!doc.objects) {
                    // If it doesn't, we're the first in the room, so it's our job to create it.
                    this.merger.applyChange("initial scene content", doc => {
                        doc.objects = new Automerge.Table();
                        doc.geometries = new Automerge.Table();
                        doc.materials = new Automerge.Table();                        
                    });

                    // Register our scene root object, so we have an ID to use in parenting objects to the scene.
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

                        // Cache our scene root with the unique ID we've generated.
                        this.sceneObjects.add(rootKey, this.sceneRoot);
                    });                    

                    console.log("Document was empty - created initial scene: " + this.sceneRoot.userData.mergeId);
                }
            }
        }

        // If there were remote changes, parse the changes.
        if (patch) {
            this.parsePatch(patch);
        }

        // Report back our reply for the networking code to send back.
        return reply;
    }

    /**
     * Internal method to populate a new database row from a scene object.
     * @param {THREE.Object3D} object3D Object to convert to a DB entry.
     * @returns {object} Object containing the transform properties to be recorded in the database.
     */
    dbFromObject(object3D) {
        return {
            name: object3D.name,
            parent: object3D.parent?.userData.mergeId,
            position: [object3D.position.x, object3D.position.y, object3D.position.z],
            quaternion: [object3D.quaternion.x, object3D.quaternion.y, object3D.quaternion.z, object3D.quaternion.w],
            scale: [object3D.scale.x, object3D.scale.y, object3D.scale.z]
        };
    }


    /**
     * Handle converting an Automerge patch data structure into changes in the THREE.js scene.
     * @param {import('automerge').Patch} patch Structure representing changes to the shared document.
     */
    parsePatch(patch) {
        // First, check for any new geometry objects to decode.
        const geoChanges = checkTableForChanges(patch, 'geometries');        
        if (geoChanges) {
            for (let key of Object.keys(geoChanges)) {
                if (!this.sceneGeometries[key]) {
                    // If we encounter a key we've never seen before, it's a new geometry object. Add it!                    
                    const data = navigateToContents(geoChanges, key);                    

                    const geo = new THREE.BufferGeometry();
                    geo.name = getPropertyValue(data, 'name');

                    
                    // Decode index and position arrays. TODO: also accept normals / texture coordinates.
                    const index = getPropertyValue(data, 'index');                    
                    geo.setIndex(index);

                    const pos = getPropertyValue(data, 'position');
                    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

                    // For now, assume normals can always be inferred from the positions & indices.
                    geo.computeVertexNormals();                    
                    
                    // Add the geometry to our cache.
                    this.sceneGeometries.add(key, geo);

                } // TODO: else case - handle a change to an existing key.
            }
        }

        // Next, check for any new materials to decode.
        const matChanges = checkTableForChanges(patch, 'materials');        
        if (matChanges) {
            for (let key of Object.keys(matChanges)) {
                if (!this.sceneMaterials[key]) {
                    // If we encounter a key we've never seen before, it's a new material. Add it!
                    const data = navigateToContents(matChanges, key);

                    // TODO: read material type to reproduce it more accurately.
                    // For now, assume all materials are Lambert, with different colours.
                    const color = getPropertyValue(data, 'color');                    
                    const mat = new THREE.MeshLambertMaterial({
                        color: new THREE.Color(color[0], color[1], color[2])
                    });
                    mat.name = getPropertyValue(data, 'name');                  

                    // Add the material to our cache.     
                    this.sceneMaterials.add(key, mat);

                } // TODO: else case - handle a change to an existing key.
            }
        }

        // Lastly, check for new objects / object changes to decode.
        // This has to be done after geometries/materials, because a Mesh object
        // may reference material or geometry items - so we need those already in-cache.
        const objectChanges = checkTableForChanges(patch, 'objects');
        // We'll also set up a list of parenting relationships to set up/change after
        // processing all new objects.
        const parentingQueue = [];
        if (objectChanges) {
            for (let key of Object.keys(objectChanges)) {
                // Try to get the local scene object and change data for this object.
                const sceneObject = this.sceneObjects[key];
                const data = navigateToContents(objectChanges, key);                
                
                if (!data) {
                    // Missing data means this object has been deleted. Remove it.
                    if (sceneObject) {
                        // First, invoke the callback in case any code needs to react just before removal.
                        if (this.onSceneObjectRemoved)
                            this.onSceneObjectRemoved(sceneObject);

                        // Remove this object from its parent, if any.
                        if (sceneObject.parent) {
                            sceneObject.parent.remove(sceneObject);
                        }

                        // Lastly, remove it from our cache, so the garbage collector can take it.
                        this.sceneObjects.remove(key);
                    }
                }
                else if (!sceneObject) {
                    // Otherwise, if we have no local copy, then this is a new object to create.

                    // We use the position field being null to distinguish the scene root object.
                    const pos = getPropertyValue(data, 'position');
                    if (pos === null && !this.sceneRoot.userData.mergeId) {
                        // Found scene root for the first time - record its ID in our cache so we can handle parenting to it correctly.
                        this.sceneObjects.add(key, this.sceneRoot);                        
                        continue;
                    }
                    
                    // For a mesh object, find its corresponding geometry and material, and invoke its constructor.
                    // TODO: Support types *other* than meshes.                    
                    const geo = this.sceneGeometries[getPropertyValue(data, 'geometry')];
                    const mat = this.sceneMaterials[getPropertyValue(data, 'material')];
                    const mesh = new THREE.Mesh(geo, mat);

                    // Apply the name and initial transformation parameters to the mesh.
                    mesh.name = getPropertyValue(data, 'name');

                    mesh.position.set(pos[0], pos[1], pos[2]);

                    const quat = getPropertyValue(data, 'quaternion');
                    mesh.quaternion.set(quat[0], quat[1], quat[2], quat[3]);

                    const scale = getPropertyValue(data, 'scale');
                    mesh.scale.set(scale[0], scale[1], scale[2]);


                    // We might not have loaded the parent yet, so queue parenting to handle at the end.
                    // We do this even if the parent is null, because we still need to invoke the onObjectAdded callback once we've finished.
                    const parentID = getPropertyValue(data, 'parent');                    
                    parentingQueue.push({child: mesh, parentKey: parentID, newAddition: true});

                    // Add the new obejct to our cache.
                    this.sceneObjects.add(key, mesh);                    
                } else {
                    // Otherwise, this is an update to an existing object - likely a transformation change.

                    if (tryUpdateTuple(sceneObject.position, data, 'position')) {
                        //console.log("...moved to", sceneObject.position);
                    }
                    if (tryUpdateTuple(sceneObject.quaternion, data, 'quaternion')) { 
                        //console.log("...rotated to", sceneObject.quaternion);
                    }
                    if (tryUpdateTuple(sceneObject.scale, data, 'scale')) {
                        //console.log("...scaled to", sceneObject.scale);
                    }

                    // If the parent changed, again, queue that until the end.
                    const parentID = getPropertyValue(data, 'parent');
                    if (parentID) {
                        parentingQueue.push({child: mesh, parentKey: parent, newAddition: false})
                    }
                }
            }
        }
        
        // Once we've loaded all objects in this patch, wire up parent relationships.
        for (let item of parentingQueue) {
            if (item.parentKey) {
                const parent = this.sceneObjects[item.parentKey];
                parent.add(item.child);
            }

            // Now that the object is fully set up, invoke the callback if it's a new object.
            if (this.onSceneObjectAdded && item.newAddition)
                this.onSceneObjectAdded(item.child);
        }
    }

    /**
     * Checks whether there are local changes to send to the server and, if so, formats them into a SyncMessage to send.
     * @returns {import('automerge').SyncMessage|null} SyncMessage to send to the server, or null if we have nothing to report.
     */
    tryGenerateSyncMessage() {
        return this.merger.makeSyncMessage(this.serverID);        
    }
}

/**
 * Method signature to use for onSceneObjectAdded / onSceneObjectRemoved callbacks.
 * @callback OnSceneObjectChange
 * @param {THREE.Object3D} Object that has changed.
 */

export { SharedScene }