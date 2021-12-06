import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { TransformControls } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/TransformControls.js";
import { FBXLoader } from './jsm/loaders/FBXLoader.js'  
import * as MKControl from './mouseKeyboardControl.mjs';
import * as ThreeMeshUI from "https://cdn.skypack.dev/three-mesh-ui"; //ui interface library

import {joinRoom,	leaveRoom,	initialize} from "./audioConnect.mjs"

// MERGE FROM https://codepen.io/oxgr/pen/NWveNBX?editors=0010
const UI = {
    raycaster: new THREE.Raycaster(),
    //pointer: new THREE.Vector2(), MKControl.mouse

    world: null,
    scale: 0,
    emote: new THREE.Group(),

    // TODO: do we need separate VRControl ?
    control: null,

    clickable: [],
    malleable: [],
    intersected: null,  

    addMode: false,
    removeMode: false,
  callMode:false,

    rollOverMesh: null,


    // currently active object:
    activeObj: null,

    tools: {},
    buttonGroup: new THREE.Group(),

    // array of text to print
    logs: [],
    textGroup: new THREE.Group(),

    isVisible: true,
    isEmoting: false,
    timer: 0,  

    init(world) {
      this.world = world;
      this.control = new TransformControls(world.mouseCamera, world.renderer.domElement);

      this.control.addEventListener("dragging-changed", function (event) {
        MKControl.enableOrbit(!event.value)
      });
      world.scene.add(this.control);

      // addButtons
      {

     //UI panelContainer
    this.colorPanel = new ThreeMeshUI.Block({
      justifyContent: 'center',
      alignContent: 'center',
      contentDirection: "column",
      fontFamily:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json",
      fontTexture:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png",
      fontSize: 0.17,
      padding: 0.002,
      borderRadius: 0.11, //0.11
      width: 0.7,
      height: 2
    });

    this.colorPanel.position.set(-1, 1, 0);
    this.colorPanel.rotation.x = -0.3; 
    this.world.scene.add(this.colorPanel);


        const buttonGeo = new THREE.DodecahedronGeometry(0.07, 0); //(0.1,0)
        const buttonMat1 = new THREE.MeshLambertMaterial({ color: 0xdd66dd });
        const buttonMat2 = new THREE.MeshLambertMaterial({ color: 0xdddd66 });
        const buttonMat3 = new THREE.MeshLambertMaterial({ color: 0x66dddd });
        const buttonMat4 = new THREE.MeshLambertMaterial({ color: 0x66dd66 });
        const buttonMat5 = new THREE.MeshLambertMaterial({ color: 0xdd6666 });
        const buttonMat6 = new THREE.MeshLambertMaterial({ color: 0xd6d6d6 });


        const buttonTranslate = new THREE.Mesh(buttonGeo, buttonMat1);
        // buttonTranslate.position.y = 0.8;
        // buttonTranslate.position.x = -0.5;
        buttonTranslate.position.set(0,0.1,0); 

        const buttonRotate = new THREE.Mesh(buttonGeo, buttonMat2);
        // buttonRotate.position.y = 0.6;
        // buttonRotate.position.x = -0.5;
        buttonRotate.position.set(0,0.1,0); 

        const buttonScale = new THREE.Mesh(buttonGeo, buttonMat3);
        // buttonScale.position.y = 0.4;
        // buttonScale.position.x = -0.5;
        buttonScale.position.set(0,0.1,0);

        const buttonAdd = new THREE.Mesh(buttonGeo, buttonMat4);
        // buttonAdd.position.y = 0.2;
        // buttonAdd.position.x = -0.5;
        buttonAdd.position.set(0,0.09,0);

        const buttonRemove = new THREE.Mesh(buttonGeo, buttonMat5);
        // buttonRemove.position.y = 0;
        // buttonRemove.position.x = -0.5;
        buttonRemove.position.set(0,0.09,0);

        const callButton = new THREE.Mesh(buttonGeo, buttonMat6);
        // callButton.position.y = 1.;
        // callButton.position.x = -0.5;
        callButton.position.set(0,0.09,0);


        // const buttonGroup = new THREE.Group();

        // this.clickable.push(buttonTranslate, buttonRotate, buttonScale, buttonAdd, buttonRemove);
        this.buttonGroup.add(buttonTranslate, buttonRotate, buttonScale, buttonAdd, buttonRemove,callButton);
        for (let b of this.buttonGroup.children) { this.clickable.push(b); }
        world.scene.add(this.buttonGroup);
        this.tools = {
          buttonTranslate,
          buttonRotate,
          buttonScale,
          buttonAdd,
          buttonRemove,
          callButton
        }

        let colorPanelText = {
          width: 0.4,
          height: 0.17,
          justifyContent: 'center',
          alignContent: 'center',
          offset: 0.005, // - Distance on the Z direction between this component and its parent. 
          margin: 0.07, //0.02 - Space between the component border and outer or neighbours components outer border.
          fontSize: 0.07,
          borderRadius: 0.075
        };
    
        // Buttons creation, with the options objects passed in parameters.
        this.buttonTranslateText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonRotateText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonScaleText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonAddText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonRemoveText = new ThreeMeshUI.Block(colorPanelText); 
        this.callButtonText = new ThreeMeshUI.Block(colorPanelText); 
        
       
        // Add texts and buttons to the panel
      //  this.callButtonText.add(new ThreeMeshUI.Text({ content: "Call Button" }), this.buttonGroup); 
        this.buttonTranslateText.add(new ThreeMeshUI.Text({ content: "Translate" }), buttonTranslate);
        this.buttonRotateText.add(new ThreeMeshUI.Text({ content: "Rotate" }), buttonRotate); 
        this.buttonScaleText.add(new ThreeMeshUI.Text({ content: "Scale" }), buttonScale);
        this.buttonAddText.add(new ThreeMeshUI.Text({ content: "Add" }), buttonAdd); 
        this.buttonRemoveText.add(new ThreeMeshUI.Text({ content: "Remove" }), buttonRemove);
        this.callButtonText.add(new ThreeMeshUI.Text({ content: "Call Button" }), callButton); 
  
        this.colorPanel.add(this.buttonTranslateText, this.buttonRotateText, this.buttonScaleText,this.buttonAddText, this.buttonRemoveText, this.callButtonText);

        // roll-over helpers (for hovering an object before adding)

        const rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
        const rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
        this.rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
        this.rollOverMesh.visible = false;
        world.scene.add( this.rollOverMesh );
      }
    },

    addTextGroupTo(destination) {
        destination.add(this.textGroup);
    },

    addButtonsTo( destination ) {
       // destination.add( this.buttonGroup );
       destination.add(this.colorPanel);
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

          case this.tools.callButton:
            
            if (this.callMode == false) {
              this.callMode = true;
              console.log('calling') 
              joinRoom() 

            }

              
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

    emotes(parent, s){
      this.timer = new Date().getTime();
      this.deleteEmote(parent);   
      this.emote.position.y = 0.55
      parent.add( this.emote );
      let tempemote = this.emote;
      let directory = './models/fbx/' + s
      let loader = new FBXLoader();
      loader.load(directory, function(fbx, emote){
        fbx.scale.set(0.003,0.003,0.003)
        fbx.position.y = 0
        fbx.rotation.y = 180;
        tempemote.add(fbx);
        // tempTextGroup.add(tempemote);
      })
    },

    getTime(){
      let distance = new Date().getTime() - this.timer;
      let seconds = Math.floor((distance % (1000 * 60)) / 1000);
      return seconds;
    },

    deleteEmote(parent){
      this.emote.remove(this.emote.children[0]);
      parent.remove(this.emote);
    },

    animate(){
      if(this.emote.position.y < 1){
        this.emote.position.y += 0.01;
      }
      this.emote.rotation.y += 0.01;     
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