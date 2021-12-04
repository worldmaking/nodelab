import * as THREE from 'https://cdn.skypack.dev/three@0.126.0/build/three.module.js';
import { TransformControls } from "https://cdn.skypack.dev/three@0.126.0/examples/jsm/controls/TransformControls.js";       
import * as MKControl from './mouseKeyboardControl.mjs';
import * as ThreeMeshUI from "https://cdn.skypack.dev/three-mesh-ui"; //ui interface library

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
  buttonGroup: new THREE.Group(),

  // array of text to print
  logs: [],
  textGroup: new THREE.Group(),

  isVisible: true,  

  //ui panel variables - START
  meshContainer: null, 
  meshes: null, 
  currentMesh: null,
  objsToTest: [],

  //mainPanel buttons
    voiceChat: null,
    rightCube: null,
    rightCubeButton: null,
    leftCube: null,
    leftCubeButton: null,
    voiceChatText: null,
    voiceChatBox: null,
    callButtonText: null,
    callButton: null,

  //mouse action tools UI stuff
  // mouse: new THREE.Vector2(),

  selectState: false,
  //ui panel variables - END

  init(world) {
    this.world = world;
    this.control = new TransformControls(world.mouseCamera, world.renderer.domElement);

    this.control.addEventListener("dragging-changed", function (event) {
      MKControl.enableOrbit(!event.value)
    });
    world.scene.add(this.control);

    // addButtons
    {
      const buttonGeo = new THREE.DodecahedronGeometry(0.1, 0);
      const buttonMat1 = new THREE.MeshLambertMaterial({ color: 0xdd66dd });
      const buttonMat2 = new THREE.MeshLambertMaterial({ color: 0xdddd66 });
      const buttonMat3 = new THREE.MeshLambertMaterial({ color: 0x66dddd });
      const buttonMat4 = new THREE.MeshLambertMaterial({ color: 0x66dd66 });
      const buttonMat5 = new THREE.MeshLambertMaterial({ color: 0xdd6666 });
      const buttonMat6 = new THREE.MeshLambertMaterial({ color: 0xd6d6d6 });

      const buttonTranslate = new THREE.Mesh(buttonGeo, buttonMat1);
      buttonTranslate.position.y = 0.8;
      buttonTranslate.position.x = -0.5;

      const buttonRotate = new THREE.Mesh(buttonGeo, buttonMat2);
      buttonRotate.position.y = 0.6;
      buttonRotate.position.x = -0.5;

      const buttonScale = new THREE.Mesh(buttonGeo, buttonMat3);
      buttonScale.position.y = 0.4;
      buttonScale.position.x = -0.5;

      const buttonAdd = new THREE.Mesh(buttonGeo, buttonMat4);
      buttonAdd.position.y = 0.2;
      buttonAdd.position.x = -0.5;

      const buttonRemove = new THREE.Mesh(buttonGeo, buttonMat5);
      buttonRemove.position.y = 0;
      buttonRemove.position.x = -0.5;

      const callButton = new THREE.Mesh(buttonGeo, buttonMat6);
      callButton.position.y = 1.;
      callButton.position.x = -0.5;

      // const buttonGroup = new THREE.Group();

      // this.clickable.push(buttonTranslate, buttonRotate, buttonScale, buttonAdd, buttonRemove);
      this.buttonGroup.add(buttonTranslate, buttonRotate, buttonScale, buttonAdd, buttonRemove, callButton);
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

      // roll-over helpers (for hovering an object before adding)

      const rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
      const rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
      this.rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
      this.rollOverMesh.visible = false;
      world.scene.add( this.rollOverMesh );
    }
  
    //UI panel
    UI.mainPanel();
    UI.panelButtons();
  },

  panelButtons(){

    //panelContainer
    this.colorPanel = new ThreeMeshUI.Block({
      justifyContent: 'center',
      alignContent: 'center',
      contentDirection: "column",
      fontFamily:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json",
      fontTexture:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png",
      fontSize: 0.17,
      padding: 0.02,
      borderRadius: 0.11,
      width: 0.7,
      height: 2
    });

 this.colorPanel.position.set(0, 3, 0);
    this.colorPanel.rotation.x = -0.3; 
    this.world.scene.add(this.colorPanel);

    let colorPanelText = {
      width: 0.8,
      height: 0.2,
      justifyContent: 'center',
      alignContent: 'center',
      offset: 0.05, //Distance on the Z direction between this component and its parent. 
      margin: 0.2, //Space between the component border and outer or neighbours components outer border.
      borderRadius: 0.075
    };

    // Buttons creation, with the options objects passed in parameters.
    this.callButtonText = new ThreeMeshUI.Block(colorPanelText); 
   
    // Add texts and buttons to the panel
   // this.callButtonText.add(new ThreeMeshUI.Text({ content: "Call Button" }), this.callButton); 
    
   // this.colorPanel.add(this.callButton);


  },

  addTextGroupTo(destination) {
      destination.add(this.textGroup);
  },

  addButtonsTo( destination ) {
      destination.add(this.buttonGroup);
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

            //
            case this.tools.callButton:
         //   this.callMode = true;
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
  },

  //UI Panel
  mainPanel() {
    console.log("TMU:", ThreeMeshUI);
    console.log("Block:", ThreeMeshUI.Block);
    this.panelContainer = new ThreeMeshUI.Block({
      justifyContent: 'center',
      alignContent: 'center',
      contentDirection: "row",
      fontFamily:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json",
      fontTexture:
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png",
      fontSize: 0.17,
      padding: 0.02,
      borderRadius: 0.11,
      width: 4,
      height: 1
    });
    
    this.panelContainer.position.set(0, 1.4, 3);
    this.panelContainer.rotation.x = -0.3; 
    this.world.scene.add(this.panelContainer);

    let panelButtonGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    let panelButtonMaterial = new THREE.MeshBasicMaterial({ color: 0x00fff0});
    
    this.voiceChatBox = new THREE.Mesh(panelButtonGeometry, panelButtonMaterial);
    this.voiceChatBox.position.set(0, 0.3, 0); 

    this.rightCube = new THREE.Mesh(panelButtonGeometry, panelButtonMaterial);
    this.rightCube.position.set(0, 0.3, 0);

    this.leftCube = new THREE.Mesh(panelButtonGeometry, panelButtonMaterial);
    this.leftCube.position.set(0, 0.3, 0);


    let TextBoxContainer = {
      width: 0.8,
      height: 0.2,
      justifyContent: 'center',
      alignContent: 'center',
      offset: 0.05, //Distance on the Z direction between this component and its parent. 
      margin: 0.2, //Space between the component border and outer or neighbours components outer border.
      borderRadius: 0.075
    };


    //when a button is hovered - text panel
    // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).
    const hoveredStateAttributes = {
      state: "hovered",
      attributes: {
        offset: 0.035,
        backgroundColor: new THREE.Color(0x9ff999), 
        backgroundOpacity: 0.2,
        fontColor: new THREE.Color(0xffffff)
      }
    };
    const idleStateAttributes = {
      state: "idle",
      attributes: {
        offset: 0.035, 
        backgroundColor: new THREE.Color(0xffbd33),
        backgroundOpacity: 0.3,
        fontColor: new THREE.Color(0xffffff)
      }
    };

    // Buttons creation, with the options objects passed in parameters.
    this.voiceChatText = new ThreeMeshUI.Block(TextBoxContainer); 
    this.rightCubeButton = new ThreeMeshUI.Block(TextBoxContainer); 
    this.leftCubeButton = new ThreeMeshUI.Block(TextBoxContainer);
    
    // Add texts and buttons to the panel
    this.voiceChatText.add(new ThreeMeshUI.Text({ content: "voiceChat" }),this.voiceChatBox); //text and object is added in here!
    this.rightCubeButton.add(new ThreeMeshUI.Text({ content: "rightCube" }),this.rightCube);
    this.leftCubeButton.add(new ThreeMeshUI.Text({ content: "leftCube" }),this.leftCube);
    
    // Create states for the buttons.
    // In the loop, we will call component.setState( 'state-name' ) when mouse hover or click
    const selectedAttributes = {
      offset: 0.02,
      backgroundColor: new THREE.Color(0x777777),
      fontColor: new THREE.Color(0x222222)
    };
    
    this.voiceChatText.setupState({
      state: "selected",
      attributes: selectedAttributes,
      onSet: () => {
        currentMesh = (currentMesh + 1) % 3;
        showMesh(currentMesh);
      }
    });
    this.voiceChatText.setupState(hoveredStateAttributes);
    this.voiceChatText.setupState(idleStateAttributes);
    
    //second button cube
    this.rightCubeButton.setupState({
      state: "selected",
      attributes: selectedAttributes,
      onSet: () => {
        currentMesh -= 1;
        if (currentMesh < 0) currentMesh = 2;
        showMesh(currentMesh);
      }
    });
    
    this.rightCubeButton.setupState(hoveredStateAttributes);
    this.rightCubeButton.setupState(idleStateAttributes);
    
    //third button cube
    this.leftCubeButton.setupState({
      state: "selected",
      attributes: selectedAttributes,
      onSet: () => {
        currentMesh -= 1;
        if (currentMesh < 0) currentMesh = 2;
        showMesh(currentMesh);
      }
    });
    this.leftCubeButton.setupState(hoveredStateAttributes);
    this.leftCubeButton.setupState(idleStateAttributes);
    
    this.panelContainer.add(this.leftCubeButton,this.voiceChatText, this.rightCubeButton);
    this.objsToTest.push(this.leftCubeButton,this.voiceChatText, this.rightCubeButton);    
  },

  // Called in the loop, get intersection with either the mouse or the VR controllers,
  // then update the buttons states according to result 
  updateButtons(vrControl) {
    // Find closest intersecting object
    let intersect;
    if (this.world.renderer.xr.isPresenting) {
      vrControl.setFromController(0, raycaster.ray);
      intersect = raycast();
      // Position the little white dot at the end of the controller pointing ray
      if (intersect) vrControl.setPointerAt(0, intersect.point);
    } else if (mouse.x !== null && mouse.y !== null) {
      raycaster.setFromCamera(mouse, camera);
      intersect = raycast();
    };
    
    // Update targeted button state (if any)
    if (intersect && intersect.object.isUI) {
      if (selectState) {
        // Component.setState internally call component.set with the options you defined in component.setupState
        intersect.object.setState("selected");
  
        //rightCube.material.color.setHex(0xff5733);            //voiceChatButton.material.color.setHex(0xfff999);

    
      } else {
        // Component.setState internally call component.set with the options you defined in component.setupState
        intersect.object.setState("hovered");
      //    voiceChatBox.rotation.y += 0.15;//Math.sin(Math.PI * 0.2);
        //  voiceChatBox.rotation.x += 0.15;//Math.sin(Math.PI * 0.2);
      //  buttonTexts( 'Right Cube', 2.1, -0.5);
        //leftCubeButton.rotation.y += 0.15;//Math.sin(Math.PI * 0.2);
      // leftCubeButton.rotation.x += 0.15;//Math.sin(Math.PI * 0.2);
    //   buttonTexts( 'Voice chat', 0., -0.5);
        
      
      };
    };
    // Update non-targeted buttons state
    objsToTest.forEach((obj) => {
      if ((!intersect || obj !== intersect.object) && obj.isUI) {
        // Component.setState internally call component.set with the options you defined in component.setupState
        obj.setState("idle");
      };
    });
  }

};

export { UI }