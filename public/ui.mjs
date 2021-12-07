import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { TransformControls } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/TransformControls.js";
import { FBXLoader } from './jsm/loaders/FBXLoader.js'
import * as MKControl from './mouseKeyboardControl.mjs';
import * as VRControl from './vrControl.mjs';
import * as ThreeMeshUI from "https://cdn.skypack.dev/three-mesh-ui"; //ui interface library

import { joinRoom, leaveRoom, initialize } from "./audioConnect.mjs"

// MERGE FROM https://codepen.io/oxgr/pen/NWveNBX?editors=0010

/** @type {THREE.Group[]} Reference to left (0) and right (1) controller.*/
let controllers;

const loader = new FBXLoader();

const emojiDuration = 8;
const emojiSpinRate = Math.PI;

const modelCache = { 
  tryLoad: function(fileName, container) {
    let result = this[fileName];
    if (result) {
      console.log("recycling cached model " + fileName);
      container.add(result);
      return;
    }
    
    const path = './models/fbx/' + fileName    
    console.log("loading emote from " + path);
    const cache = this;
    loader.load(path, function (fbx, emote) {
      fbx.scale.set(0.003, 0.003, 0.003);
      fbx.position.y = 0;
      fbx.rotation.y = 180;
      container.add(fbx);
      cache[fileName] = fbx;
    });
  }
};

const UI = {

  lastAction: {action: null, value: null},

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
  callMode: false,


  rollOverMesh: null,

  leftClicked: false,
  rightClicked: false,
  parent: null,

  // currently active object:
  activeObj: null,

  tools: {},
  buttonGroup: new THREE.Group(),
  emojis: {},

  // array of text to print
  logs: [],
  textGroup: new THREE.Group(),


  isVisible: true,
  isEmoting: false,
  timer: 0,
    
  //UI panel for emotes
  emotePanel: null,
  emotesGroup: new THREE.Group(),

  //UI panel for main buttons 
  colorPanel: null,

  replicaEmotes: [],

  init(world) {
    this.world = world;
    this.control = new TransformControls(world.mouseCamera, world.renderer.domElement);

    this.control.addEventListener("dragging-changed", function (event) {
      MKControl.enableOrbit(!event.value)
      });
      world.scene.add(this.control);

      // addButtons
      {
    this.emotePanel = new ThreeMeshUI.Block({
      justifyContent: 'center',
      alignContent: 'center',
      contentDirection: "row",
      fontFamily:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json",
      fontTexture:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png",
      fontSize: 0.13,
      padding: 0,
      borderRadius: 0.11,
      width: 1.7,
      height: 0.2
    });
    this.emotePanel.position.set(0, 0, -1);
    this.emotePanel.rotation.x = -0.4;
    this.emotePanel.scale.set(0.5,0.5,0.5); 
    this.world.scene.add(this.emotePanel);

    this.emotePanel2 = new ThreeMeshUI.Block({
      justifyContent: 'center',
      alignContent: 'center',
      contentDirection: "row",
      fontFamily:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json",
      fontTexture:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png",
      fontSize: 0.13,
      padding: 0,
      borderRadius: 0.11,
      width: 1.4,
      height: 0.2
    });
    this.emotePanel2.position.set(0, -0.15, -1);
    this.emotePanel2.rotation.x = -0.4;
    this.emotePanel2.scale.set(0.5,0.5,0.5); 
    this.world.scene.add(this.emotePanel2);

     //UI panelContainer
    this.colorPanel = new ThreeMeshUI.Block({
      justifyContent: 'center',
      alignContent: 'center',
      contentDirection: "row",
      fontFamily:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json",
      fontTexture:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png",
      fontSize: 0.17,
      padding: 0.2, 
      borderRadius: 0.05, 
      width: 2.2, 
      height: 0.4 
    });
    world.scene.add(this.control);

    this.colorPanel.position.set(0, 0.2, -1);
    this.colorPanel.rotation.x = -0.4;
    this.colorPanel.scale.set(0.5,0.5,0.5); 
    this.world.scene.add(this.colorPanel);


        const buttonGeo = new THREE.DodecahedronGeometry(0.07, 0); //(0.1,0)
        const buttonMat1 = new THREE.MeshLambertMaterial({ color: 0xdd66dd });
        const buttonMat2 = new THREE.MeshLambertMaterial({ color: 0xdddd66 });
        const buttonMat3 = new THREE.MeshLambertMaterial({ color: 0x66dddd });
        const buttonMat4 = new THREE.MeshLambertMaterial({ color: 0x66dd66 });
        const buttonMat5 = new THREE.MeshLambertMaterial({ color: 0xdd6666 });
        const buttonMat6 = new THREE.MeshLambertMaterial({ color: 0xd6d6d6 });
        const emotesColour = new THREE.MeshLambertMaterial({ color: 'yellow' });

        const p = new THREE.Mesh(buttonGeo, emotesColour);
        p.position.set(0,0.1,0); 

        const brain = new THREE.Mesh(buttonGeo, emotesColour);
        brain.position.set(0,0.1,0); 

        const laugh = new THREE.Mesh(buttonGeo, emotesColour);
        laugh.position.set(0,0.1,0);
        
        const love = new THREE.Mesh(buttonGeo, emotesColour);
        love.position.set(0,0.1,0);

        const smile = new THREE.Mesh(buttonGeo, emotesColour);
        smile.position.set(0,0.1,0);

        const surprised = new THREE.Mesh(buttonGeo, emotesColour);
        surprised.position.set(0,0.1,0);

        const thinking = new THREE.Mesh(buttonGeo, emotesColour);
        thinking.position.set(0,0.1,0);

        this.emotesGroup.add(p, brain, laugh, love, smile, surprised, thinking);
        this.world.scene.add(this.emotesGroup);


        const buttonTranslate = new THREE.Mesh(buttonGeo, buttonMat1);
        // buttonTranslate.position.y = 0.8;
        // buttonTranslate.position.x = -0.5;
        buttonTranslate.position.set(0,0.1,0); 

        const  buttonRotate = new THREE.Mesh(buttonGeo, buttonMat2);
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

        for(let e of this.emotesGroup.children){
          this.clickable.push(e);
        }
        this.emojis = {
          brain,
          p,
          laugh,
          love,
          smile,
          surprised,
          thinking,
        }

        //UI inner panel for texts
        let colorPanelText = {
          width: 0.3,
          height: 0.15,
          justifyContent: 'center',
          alignContent: 'center',
          offset: 0.05, // - Distance on the Z direction between this component and its parent. 
          margin: 0.02, //0.02 - Space between the component border and outer or neighbours components outer border.
          fontSize: 0.04,
          borderRadius: 0.075
        };

         //UI inner panel for emote texts
         let EmotePanelText = {
          width: 0.3,
          height: 0.15,
          justifyContent: 'center',
          alignContent: 'center',
          offset: 0.005, // - Distance on the Z direction between this component and its parent. 
          margin: 0.02, //0.02 - Space between the component border and outer or neighbours components outer border.
          fontSize: 0.04,
          borderRadius: 0.075
        };

        // Buttons creation, with the options objects passed in parameters.
        this.buttonTranslateText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonRotateText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonScaleText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonAddText = new ThreeMeshUI.Block(colorPanelText); 
        this.buttonRemoveText = new ThreeMeshUI.Block(colorPanelText); 
        this.callButtonText = new ThreeMeshUI.Block(colorPanelText); 

        this.brainText = new ThreeMeshUI.Block(EmotePanelText); 
        this.smile = new ThreeMeshUI.Block(EmotePanelText);
        this.laugh = new ThreeMeshUI.Block(EmotePanelText);
        this.love = new ThreeMeshUI.Block(EmotePanelText);
        this.surprised = new ThreeMeshUI.Block(EmotePanelText);
        this.thinking = new ThreeMeshUI.Block(EmotePanelText);
        this.p = new ThreeMeshUI.Block(EmotePanelText); 
       
        // Add texts and buttons to the panel
        this.buttonTranslateText.add(new ThreeMeshUI.Text({ content: "Translate" }), buttonTranslate);
        this.buttonRotateText.add(new ThreeMeshUI.Text({ content: "Rotate" }), buttonRotate); 
        this.buttonScaleText.add(new ThreeMeshUI.Text({ content: "Scale" }), buttonScale);
        this.buttonAddText.add(new ThreeMeshUI.Text({ content: "Add" }), buttonAdd); 
        this.buttonRemoveText.add(new ThreeMeshUI.Text({ content: "Remove" }), buttonRemove);
        this.callButtonText.add(new ThreeMeshUI.Text({ content: "Call Button" }), callButton);

        this.brainText.add(new ThreeMeshUI.Text({ content: "Brain Explode" }), brain);
        this.smile.add(new ThreeMeshUI.Text({ content: ":D" }), smile);
        this.laugh.add(new ThreeMeshUI.Text({ content: "Laugh" }), laugh);
        this.love.add(new ThreeMeshUI.Text({ content: "Love" }), love);
        this.surprised.add(new ThreeMeshUI.Text({ content: "Surprised" }), surprised);
        this.thinking.add(new ThreeMeshUI.Text({ content: "thinking" }), thinking);
        this.p.add(new ThreeMeshUI.Text({ content: ";p" }), p);


        this.colorPanel.add(this.buttonTranslateText, this.buttonRotateText, this.buttonScaleText,this.buttonAddText, this.buttonRemoveText, this.callButtonText);
        this.emotePanel.add(this.p, this.brainText, this.laugh, this.love);
        this.emotePanel2.add(this.smile, this.surprised, this.thinking);

        // roll-over helpers (for hovering an object before adding)

        const rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
        const rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
        this.rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
        this.rollOverMesh.visible = false;
        world.scene.add( this.rollOverMesh );
      }
    },

    addTextGroupTo(destination) {
      this.parent = destination;
        destination.add(this.textGroup);
    },

    addButtonsTo( destination ) {
       // destination.add( this.buttonGroup );
       this.parent = destination;
      //destination.add(this.colorPanel);
       //destination.add(this.emotePanel);
       //destination.add(this.emotePanel2);

       this.world.scene.remove(this.colorPanel, this.emotePanel, this.emotePanel2);
      //main ui control with the key "m"
       document.addEventListener('keypress', (event) => {
        if(event.key == "m"){
         if(this.colorPanel.isVisible){
            this.colorPanel.isVisible = false;
            this.emotePanel.isVisible = false;
            this.emotePanel2.isVisible = false;
           // console.log("inside if");
            this.world.scene.remove(this.colorPanel, this.emotePanel, this.emotePanel2);
            destination.remove(this.colorPanel, this.emotePanel, this.emotePanel2);
         } else {
            this.colorPanel.isVisible = true;
            this.emotePanel.isVisible = true;
            this.emotePanel2.isVisible = true;
            this.world.scene.add(this.colorPanel, this.emotePanel, this.emotePanel2);
            destination.add(this.colorPanel, this.emotePanel, this.emotePanel2);
          //  console.log(UI.colorPanel.position.x);
         }
        }
     });

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

  activateObj(obj) {

    this.control.detach();
    this.control.attach(obj);
    this.activeObj = obj;

  },

  updateMK(dt, MKControl, camera) {


    this.lastAction.action = null;
    this.lastAction.value = null;

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

    if ( MKControl.mouseButtons[0] && this.intersected) {

      if (!this.leftClicked) {

        this.leftClicked = true;
        const obj = this.intersected;

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
              console.log('calling');
              joinRoom();
            }
            break;
          case this.emojis.brain:
            this.emotes(this.parent, 'brain.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.p:
            this.emotes(this.parent, ';p.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.smile:
            this.emotes(this.parent, 'smile.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.laugh:
            this.emotes(this.parent, 'laugh.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.thinking:
            this.emotes(this.parent, 'thinking.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.love:
            this.emotes(this.parent, 'love.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.surprised:
            this.emotes(this.parent, 'surprised.fbx')
            this.isEmoting = true;
            break;

        }

        if (Object.values(this.tools).includes(obj)) {

          if (obj != this.tools.buttonAdd) {  // if the obj is a button, but not the remove button, turn remove mode off.
            this.addMode = false;
          }

          if (obj != this.tools.buttonRemove) {  // if the obj is a button, but not the remove button, turn remove mode off.
            this.removeMode = false;
            // console.log('you clicked a button thats not buttonRemove');
          }

        }

        if (this.malleable.includes(obj)) { // if the obj is part of the malleable objects array,
          if (this.removeMode) {
            this.world.scene.remove(obj);
            this.print("box removed");
            if (obj == this.activeObj) {
              this.control.detach();
              this.activeObj = null;
            }
          } else if (obj !== this.activeObj) {
            this.activateObj(obj);
          }
        }
      }
    }

    if ( !MKControl.mouseButtons[0]) { // if left mouse button is up
      this.leftClicked = false;
    }
  },

  updateVR(dt, VRControl) {

    this.lastAction.action = null;
    this.lastAction.value = null;

    if(VRControl.getOrigin() != undefined)
    this.raycaster.set(VRControl.getOrigin(), VRControl.getAim());

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

    if ( VRControl.uiTrigger && this.intersected) {

      if (!this.leftClicked) {

        this.leftClicked = true;
        const obj = this.intersected;

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
              console.log('calling');
              joinRoom();
            }
            break;
          case this.emojis.brain:
            this.emotes(this.parent, 'brain.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.p:
            this.emotes(this.parent, ';p.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.smile:
            this.emotes(this.parent, 'smile.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.laugh:
            this.emotes(this.parent, 'laugh.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.thinking:
            this.emotes(this.parent, 'thinking.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.love:
            this.emotes(this.parent, 'love.fbx')
            this.isEmoting = true;
            break;
          case this.emojis.surprised:
            this.emotes(this.parent, 'surprised.fbx')
            this.isEmoting = true;
            break;

        }

        if (Object.values(this.tools).includes(obj)) {

          if (obj != this.tools.buttonAdd) {  // if the obj is a button, but not the remove button, turn remove mode off.
            this.addMode = false;
          }

          if (obj != this.tools.buttonRemove) {  // if the obj is a button, but not the remove button, turn remove mode off.
            this.removeMode = false;
            // console.log('you clicked a button thats not buttonRemove');
          }

        }

        if (this.malleable.includes(obj)) { // if the obj is part of the malleable objects array,
          if (this.removeMode) {
            this.world.scene.remove(obj);
            this.print("box removed");
            if (obj == this.activeObj) {
              this.control.detach();
              this.activeObj = null;
            }
          } else if (obj !== this.activeObj) {
            this.activateObj(obj);
          }
        }
      }
    }

    if ( !VRControl.uiOtherTrigger ) { // if left mouse button is up
      this.leftClicked = false;
    }
  },
  
  // adds the emoji to the scene
  emotes(parent, s) {
    this.lastAction.action = "emote";
    this.lastAction.value = s;
    
    this.timer = new Date().getTime();
    this.deleteEmote();
    this.emote.position.y = 0.55
    parent.add(this.emote);
    let tempemote = this.emote;

    modelCache.tryLoad(s, tempemote);
  },
  //gets the time the emoji has been in the world
  getTime() {
    let distance = new Date().getTime() - this.timer;
    let seconds = Math.floor((distance % (1000 * 60)) / 1000);
    return seconds;
  },
  // deletes the emoji
  deleteEmote() {
    this.emote.remove(this.emote.children[0]);
    this.parent.remove(this.emote);
    this.isEmoting = false;
  },
  //animates the emoji
  animate(dt) {
    if (this.isEmoting && this.getTime() < emojiDuration) {
      this.emote.position.y +=(1.0 - this.emote.position.y) * dt;
      this.emote.rotation.y += emojiSpinRate * dt;
    } else {
      this.deleteEmote();
    }

    for (const e of this.replicaEmotes) {
      if (e.userData.lifeSpan <= 0) continue;

      e.position.y += (1.0 - e.position.y) * dt;
      e.rotation.y += emojiSpinRate * dt;
      e.userData.lifeSpan -= dt;
      
      if (e.userData.lifeSpan <= 0 && e.parent) {
        e.parent.remove(e);   
      }
    }
  },


  // Printing to screen by Jorge

  // function to add 3d text to the world, functionality right now is mainly to debug in vr
  print(s) {
    this.logs.push(s);
    if (this.logs.length > 9) {
      this.logs.shift();
    }
    const loader = new THREE.FontLoader();
    let tempLogs = this.logs;
    let tempTextGroup = this.textGroup;
    loader.load('./fonts/Roboto_Regular.json', function (font) {
      for (let i = 0; i < tempTextGroup.children.length; i++) {
        tempTextGroup.remove(tempTextGroup.children[i])
      }
      let y = 0.8;
      for (let i = tempLogs.length - 1; i >= 0; i--) {
        const textGeo = new THREE.TextGeometry(tempLogs[i].toString(), {
          font: font,
          size: 0.15,
          height: .04,
        });

        let textMesh = new THREE.Mesh(textGeo, new THREE.MeshLambertMaterial());
        textMesh.position.x = 0;
        textMesh.position.y = y;
        textMesh.position.z = -1;
        tempTextGroup.add(textMesh);
        y -= 0.2;
      }
    }
    );
  },

  playEmoteOnReplica(replica, fileName) {
    let container = replica.emote;

    if (!container) {    
      container = new THREE.Group();    
      replica.emote = container;
      this.replicaEmotes.push(container);
    } 
    
    if (!container.parent) {
      replica.getBody().add(container);
    }

    if (container.lastEmote === fileName) {
      return;
    }

    console.log(`remote user sends emote ${fileName}`);

    container.position.y = 0.55;
    container.userData.lifeSpan = emojiDuration;
    modelCache.tryLoad(fileName, container);
    replica.emote.lastEmote = fileName;
  }
};

export { UI }