import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { TransformControls } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/TransformControls.js";       
import * as MKControl from './mouseKeyboardControl.mjs';

// MERGE FROM https://codepen.io/oxgr/pen/NWveNBX?editors=0010
const UI = {
    raycaster: new THREE.Raycaster(),
    //pointer: new THREE.Vector2(), MKControl.mouse

    world: null,

    // TODO: do we need separate VRControl ?
    control: null,

    clickable: [],
    malleable: [],
    intersected: null,  

    addMode: false,
    removeMode: false,

    rollOverMesh: null,

    // currently active object:
    activeObj: null,

    tools: {},

    // array of text to print
    logs: [],
    textGroup: new THREE.Group(),

    isVisible: true,  

    init(world) {
      this.world = world;
      this.control = new TransformControls(world.mouseCamera, world.renderer.domElement);

      this.control.addEventListener("dragging-changed", function (event) {
        MKControl.enableOrbit(!event.value)
      });
      world.scene.add(this.control);

      // addButtons
      {
        const buttonGeo = new THREE.DodecahedronGeometry(1, 0);
        const buttonMat1 = new THREE.MeshLambertMaterial({ color: 0xdd66dd });
        const buttonMat2 = new THREE.MeshLambertMaterial({ color: 0xdddd66 });
        const buttonMat3 = new THREE.MeshLambertMaterial({ color: 0x66dddd });
        const buttonMat4 = new THREE.MeshLambertMaterial({ color: 0x66dd66 });
        const buttonMat5 = new THREE.MeshLambertMaterial({ color: 0xdd6666 });

        const buttonTranslate = new THREE.Mesh(buttonGeo, buttonMat1);
        buttonTranslate.position.z = 10;
        buttonTranslate.position.x = -6;

        const  buttonRotate = new THREE.Mesh(buttonGeo, buttonMat2);
        buttonRotate.position.z = 10;
        buttonRotate.position.x = -3;

        const buttonScale = new THREE.Mesh(buttonGeo, buttonMat3);
        buttonScale.position.z = 10;
        buttonScale.position.x = 0;

        const buttonAdd = new THREE.Mesh(buttonGeo, buttonMat4);
        buttonAdd.position.z = 10;
        buttonAdd.position.x = 3;

        const buttonRemove = new THREE.Mesh(buttonGeo, buttonMat5);
        buttonRemove.position.z = 10;
        buttonRemove.position.x = 6;

        const buttonGroup = new THREE.Group();

        // this.clickable.push(buttonTranslate, buttonRotate, buttonScale, buttonAdd, buttonRemove);
        buttonGroup.add(buttonTranslate, buttonRotate, buttonScale, buttonAdd, buttonRemove);
        for (let b of buttonGroup.children) { this.clickable.push(b); }
        world.scene.add(buttonGroup);
        this.tools = {
          buttonTranslate,
          buttonRotate,
          buttonScale,
          buttonAdd,
          buttonRemove
        }

        // roll-over helpers

        const rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
        const rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
        this.rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
        this.rollOverMesh.visible = false;
        world.scene.add( this.rollOverMesh );
      }
    },

    addNewObj(pos) {
      let newBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })
      );
      newBox.position.x = pos.x;
      newBox.position.y = pos.y;
      newBox.position.z = pos.z;
      // newBox.rotation = new THREE.Euler().setFromVector3(pos);
      this.world.scene.add(newBox);
      this.clickable.push(newBox);
      this.malleable.push(newBox);

      this.print("box added");
    //   this.print(newBox.color.toString());
      
      // console.log(objects.toString());
    },

    activateObj( obj ) {

      this.control.detach();
      this.control.attach( obj );
      this.activeObj = obj;
      
    },

    updateMK(dt, MKControl, camera) {
      this.raycaster.setFromCamera(MKControl.mouse, camera);

      const intersects = this.raycaster.intersectObjects(this.clickable, false);
      if (intersects.length > 0) {
        if (this.intersected != intersects[0].object) {
          if (this.intersected)
          this.intersected.material.emissive.setHex(this.intersected.currentHex);

          this.intersected = intersects[0].object;
          this.intersected.currentHex = this.intersected.material.emissive.getHex();
          this.intersected.material.emissive.setHex(0x333333);
        }
      } else {
        if (this.intersected) {
          this.intersected.material.emissive.setHex(this.intersected.currentHex);
        }
        this.intersected = null;
      }

    //   if (this.addMode) {
    //     this.rollOverMesh.visible = true;
    //     this.rollOverMesh.position.copy( intersects[ 0 ].point ).add( intersects[ 0 ].face.normal );
    //   } else {
    //     this.rollOverMesh.visible = false;
    //   }

      if(MKControl.mouseButtons[0] && this.intersected) {
        const obj = this.intersected;
        // console.log(obj);
        switch (obj) {
          case this.tools.buttonTranslate:
            this.control.setMode("translate");
            break;

          case this.tools.buttonRotate:
          this.control.setMode("rotate");
            break;

          case this.tools.buttonScale:
          this.control.setMode("scale");
            break;

          case this.tools.buttonAdd:
            this.addMode = true;
            this.addNewObj(new THREE.Vector3().random());
            break;

          case this.tools.buttonRemove:
            this.removeMode = true;
            // updateActiveButton( obj );
            break;
        }

        if ( Object.values(this.tools).includes(obj) ) {
          
          if ( obj != this.tools.buttonAdd ) {  // if the obj is a button, but not the remove button, turn remove mode off.
            this.addMode = false;
          }

          if (obj != this.tools.buttonRemove ) {  // if the obj is a button, but not the remove button, turn remove mode off.
            this.removeMode = false;
            // console.log('you clicked a button thats not buttonRemove');
          }

        }
        
        if (this.malleable.includes(obj)) { // if the obj is part of the malleable objects array,
          if (this.removeMode) {
            this.world.scene.remove(obj);
            this.print("box removed");
            if ( obj == this.activeObj ) {
              this.control.detach();
              this.activeObj = null;
            }
          } else if (obj !== this.activeObj) {
            this.activateObj ( obj );
          }
        }
      }
    },
    // Printing to screen by Jorge
    
    // function to add 3d text to the world, functionality right now is mainly to debug in vr
    print(s){
        this.logs.push(s);
        if(this.logs.length > 9){
          this.logs.shift();
        }
        const loader = new THREE.FontLoader();
        let tempLogs = this.logs;
        let tempTextGroup = this.textGroup; 
        loader.load( './fonts/Roboto_Regular.json', function ( font ) {
           for(let i = 0; i < tempTextGroup.children.length; i++){
             tempTextGroup.remove(tempTextGroup.children[i])
           }
          let y = 0.8; 
          for(let i = tempLogs.length - 1; i >= 0; i--){
            const textGeo = new THREE.TextGeometry( tempLogs[i].toString(), {
            font: font,
            size: 0.15,
            height: .04,
            } );
            
            let textMesh = new THREE.Mesh(textGeo, new THREE.MeshLambertMaterial());  
            textMesh.position.x = 0;
            textMesh.position.y = y;
            textMesh.position.z = -1;
            tempTextGroup.add(textMesh);
            y -= 0.2;
          }      
          }
        );
      }
  };

  export { UI }