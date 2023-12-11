var dat = require("dat-gui");
var Stats = require("stats.js");
var css = require("dom-css");
var raf = require("raf");

var THREE = require("three");

var OrbitControls = require("./controls/OrbitControls");
var settings = require("./core/settings");

var mobile = require("./fallback/mobile");
var encode = require("mout/queryString/encode");

var fboHelper = require("./3d/fboHelper");
var simulator = require("./3d/simulator");
var particles = require("./3d/particles");
var lights = require("./3d/lights");
var floor = require("./3d/floor");

var _gui;
var _stats;

var _width = 0;
var _height = 0;

var _control;
var _camera;
var _scene;
var _renderer;

var _time = 0;
var _ray = new THREE.Ray();

var _initAnimation = 0;

var _bgColor;

function init() {
  if (settings.useStats) {
    _stats = new Stats();
    css(_stats.domElement, {
      position: "absolute",
      left: "0px",
      top: "0px",
      zIndex: 2048,
    });

    document.body.appendChild(_stats.domElement);
  }

  _bgColor = new THREE.Color(settings.bgColor);
  settings.mouse = new THREE.Vector2(0, 0);
  settings.mouse3d = _ray.origin;

  _renderer = new THREE.WebGLRenderer({
    // transparent : true,
    // premultipliedAlpha : false,
    antialias: true,
  });
  _renderer.setClearColor(settings.bgColor);
  _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  _renderer.shadowMap.enabled = true;
  document.body.appendChild(_renderer.domElement);

  _scene = new THREE.Scene();
  _scene.fog = new THREE.FogExp2(settings.bgColor, 0.001);

  _camera = new THREE.PerspectiveCamera(45, 1, 10, 3000);
  _camera.position.set(300, 60, 300).normalize().multiplyScalar(1000);
  settings.camera = _camera;
  settings.cameraPosition = _camera.position;

  fboHelper.init(_renderer);

  simulator.init(_renderer);
  particles.init();
  _scene.add(particles.container);

  lights.init(_renderer);
  _scene.add(lights.mesh);

  floor.init(_renderer);
  floor.mesh.position.y = -100;
  _scene.add(floor.mesh);

  _control = new OrbitControls(_camera, _renderer.domElement);
  _control.target.y = 50;
  _control.maxDistance = 1000;
  _control.minPolarAngle = 0.3;
  _control.maxPolarAngle = Math.PI / 2 - 0.1;
  _control.noPan = true;
  _control.update();

  _gui = new dat.GUI();

  if (settings.isMobile) {
    _gui.close();
    _control.enabled = false;
  }

  var simulatorGui = _gui.addFolder("Simulator");
  simulatorGui
    .add(settings.query, "amount", settings.amountList)
    .onChange(function () {
      if (confirm("It will restart the demo")) {
        window.location.href =
          window.location.href.split("#")[0] +
          encode(settings.query).replace("?", "#");
        window.location.reload();
      }
    });
  simulatorGui.add(settings, "speed", 0, 3).listen();
  simulatorGui.add(settings, "dieSpeed", 0.0005, 0.05).listen();
  simulatorGui.add(settings, "radius", 0.2, 3);
  simulatorGui.add(settings, "curlSize", 0.001, 0.05).listen();
  simulatorGui.add(settings, "attraction", -2, 2);
  simulatorGui.add(settings, "followMouse").name("follow mouse");
  simulatorGui.open();

  var renderingGui = _gui.addFolder("Rendering");
  renderingGui.add(settings, "shadowDarkness", 0, 1).name("shadow");
  renderingGui.addColor(settings, "color1").name("base Color");
  renderingGui.addColor(settings, "color2").name("fade Color");
  renderingGui.addColor(settings, "bgColor").name("background Color");
  renderingGui.open();

  var preventDefault = function (evt) {
    evt.preventDefault();
    this.blur();
  };
  Array.prototype.forEach.call(
    _gui.domElement.querySelectorAll('input[type="checkbox"],select'),
    function (elem) {
      elem.onkeyup = elem.onkeydown = preventDefault;
      elem.style.color = "#000";
    }
  );

  window.addEventListener("resize", _onResize);
  window.addEventListener("mousemove", _onMove);
  window.addEventListener("keyup", _onKeyUp);

  _time = Date.now();
  _onResize();
  _loop();
}

function _onKeyUp(evt) {
  if (evt.keyCode === 32) {
    settings.speed = settings.speed === 0 ? 1 : 0;
    settings.dieSpeed = settings.dieSpeed === 0 ? 0.015 : 0;
  }
}

function _onMove(evt) {
  settings.mouse.x = (evt.pageX / _width) * 2 - 1;
  settings.mouse.y = -(evt.pageY / _height) * 2 + 1;
}

function _onResize() {
  _width = window.innerWidth;
  _height = window.innerHeight;

  _renderer.setSize(_width, _height);
  _camera.aspect = _width / _height;
  _camera.updateProjectionMatrix();
}

function _loop() {
  var newTime = Date.now();
  raf(_loop);
  if (settings.useStats) _stats.begin();
  _render(newTime - _time);
  if (settings.useStats) _stats.end();
  _time = newTime;
}

function _render(dt) {
  _bgColor.setStyle(settings.bgColor);
  var tmpColor = floor.mesh.material.color;
  tmpColor.lerp(_bgColor, 0.05);

  _scene.fog.color.copy(tmpColor);
  _renderer.setClearColor(tmpColor.getHex());

  _initAnimation = Math.min(_initAnimation + dt * 0.00025, 1);
  simulator.initAnimation = _initAnimation;
  _control.maxDistance = _initAnimation === 1 ? 1000 : 450;
  _control.update();
  lights.update();

  // update mouse3d
  _camera.updateMatrixWorld();
  _ray.origin.setFromMatrixPosition(_camera.matrixWorld);
  _ray.direction
    .set(settings.mouse.x, settings.mouse.y, 0.5)
    .unproject(_camera)
    .sub(_ray.origin)
    .normalize();
  var distance =
    _ray.origin.length() /
    Math.cos(Math.PI - _ray.direction.angleTo(_ray.origin));
  _ray.origin.add(_ray.direction.multiplyScalar(distance * 1.0));
  simulator.update(dt);
  particles.update();

  _renderer.render(_scene, _camera);
}

mobile.pass(init);
