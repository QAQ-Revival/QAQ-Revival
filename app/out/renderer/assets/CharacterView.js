import { g as getDefaultExportFromCjs, r as reactExports, R as ReactDOM, j as jsxRuntimeExports, _ as __vitePreload } from "./index.js";
import { i as isManagedInstallContentType, M as MANAGED_INSTALL_OPTIONS, n as normalizeInstallContentType, g as getInstallContentTypeLabel, a as getManagedInstallResultMessage } from "./managedInstall.js";
import HiddenCharactersDialog from "./HiddenCharactersDialog.js";
var extendStatics = function(d, b) {
  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
    d2.__proto__ = b2;
  } || function(d2, b2) {
    for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
  };
  return extendStatics(d, b);
};
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
var __assign = function() {
  __assign = Object.assign || function __assign2(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
var _populated = false;
var _ie, _firefox, _opera, _webkit, _chrome;
var _ie_real_version;
var _osx, _windows, _linux, _android;
var _win64;
var _iphone, _ipad, _native;
var _mobile;
function _populate() {
  if (_populated) {
    return;
  }
  _populated = true;
  var uas = navigator.userAgent;
  var agent = /(?:MSIE.(\d+\.\d+))|(?:(?:Firefox|GranParadiso|Iceweasel).(\d+\.\d+))|(?:Opera(?:.+Version.|.)(\d+\.\d+))|(?:AppleWebKit.(\d+(?:\.\d+)?))|(?:Trident\/\d+\.\d+.*rv:(\d+\.\d+))/.exec(uas);
  var os = /(Mac OS X)|(Windows)|(Linux)/.exec(uas);
  _iphone = /\b(iPhone|iP[ao]d)/.exec(uas);
  _ipad = /\b(iP[ao]d)/.exec(uas);
  _android = /Android/i.exec(uas);
  _native = /FBAN\/\w+;/i.exec(uas);
  _mobile = /Mobile/i.exec(uas);
  _win64 = !!/Win64/.exec(uas);
  if (agent) {
    _ie = agent[1] ? parseFloat(agent[1]) : agent[5] ? parseFloat(agent[5]) : NaN;
    if (_ie && document && document.documentMode) {
      _ie = document.documentMode;
    }
    var trident = /(?:Trident\/(\d+.\d+))/.exec(uas);
    _ie_real_version = trident ? parseFloat(trident[1]) + 4 : _ie;
    _firefox = agent[2] ? parseFloat(agent[2]) : NaN;
    _opera = agent[3] ? parseFloat(agent[3]) : NaN;
    _webkit = agent[4] ? parseFloat(agent[4]) : NaN;
    if (_webkit) {
      agent = /(?:Chrome\/(\d+\.\d+))/.exec(uas);
      _chrome = agent && agent[1] ? parseFloat(agent[1]) : NaN;
    } else {
      _chrome = NaN;
    }
  } else {
    _ie = _firefox = _opera = _chrome = _webkit = NaN;
  }
  if (os) {
    if (os[1]) {
      var ver = /(?:Mac OS X (\d+(?:[._]\d+)?))/.exec(uas);
      _osx = ver ? parseFloat(ver[1].replace("_", ".")) : true;
    } else {
      _osx = false;
    }
    _windows = !!os[2];
    _linux = !!os[3];
  } else {
    _osx = _windows = _linux = false;
  }
}
var UserAgent_DEPRECATED$1 = {
  /**
   *  Check if the UA is Internet Explorer.
   *
   *
   *  @return float|NaN Version number (if match) or NaN.
   */
  ie: function() {
    return _populate() || _ie;
  },
  /**
   * Check if we're in Internet Explorer compatibility mode.
   *
   * @return bool true if in compatibility mode, false if
   * not compatibility mode or not ie
   */
  ieCompatibilityMode: function() {
    return _populate() || _ie_real_version > _ie;
  },
  /**
   * Whether the browser is 64-bit IE.  Really, this is kind of weak sauce;  we
   * only need this because Skype can't handle 64-bit IE yet.  We need to remove
   * this when we don't need it -- tracked by #601957.
   */
  ie64: function() {
    return UserAgent_DEPRECATED$1.ie() && _win64;
  },
  /**
   *  Check if the UA is Firefox.
   *
   *
   *  @return float|NaN Version number (if match) or NaN.
   */
  firefox: function() {
    return _populate() || _firefox;
  },
  /**
   *  Check if the UA is Opera.
   *
   *
   *  @return float|NaN Version number (if match) or NaN.
   */
  opera: function() {
    return _populate() || _opera;
  },
  /**
   *  Check if the UA is WebKit.
   *
   *
   *  @return float|NaN Version number (if match) or NaN.
   */
  webkit: function() {
    return _populate() || _webkit;
  },
  /**
   *  For Push
   *  WILL BE REMOVED VERY SOON. Use UserAgent_DEPRECATED.webkit
   */
  safari: function() {
    return UserAgent_DEPRECATED$1.webkit();
  },
  /**
   *  Check if the UA is a Chrome browser.
   *
   *
   *  @return float|NaN Version number (if match) or NaN.
   */
  chrome: function() {
    return _populate() || _chrome;
  },
  /**
   *  Check if the user is running Windows.
   *
   *  @return bool `true' if the user's OS is Windows.
   */
  windows: function() {
    return _populate() || _windows;
  },
  /**
   *  Check if the user is running Mac OS X.
   *
   *  @return float|bool   Returns a float if a version number is detected,
   *                       otherwise true/false.
   */
  osx: function() {
    return _populate() || _osx;
  },
  /**
   * Check if the user is running Linux.
   *
   * @return bool `true' if the user's OS is some flavor of Linux.
   */
  linux: function() {
    return _populate() || _linux;
  },
  /**
   * Check if the user is running on an iPhone or iPod platform.
   *
   * @return bool `true' if the user is running some flavor of the
   *    iPhone OS.
   */
  iphone: function() {
    return _populate() || _iphone;
  },
  mobile: function() {
    return _populate() || (_iphone || _ipad || _android || _mobile);
  },
  nativeApp: function() {
    return _populate() || _native;
  },
  android: function() {
    return _populate() || _android;
  },
  ipad: function() {
    return _populate() || _ipad;
  }
};
var UserAgent_DEPRECATED_1 = UserAgent_DEPRECATED$1;
var canUseDOM = !!(typeof window !== "undefined" && window.document && window.document.createElement);
var ExecutionEnvironment$1 = {
  canUseDOM
};
var ExecutionEnvironment_1 = ExecutionEnvironment$1;
var ExecutionEnvironment = ExecutionEnvironment_1;
var useHasFeature;
if (ExecutionEnvironment.canUseDOM) {
  useHasFeature = document.implementation && document.implementation.hasFeature && // always returns true in newer browsers as per the standard.
  // @see http://dom.spec.whatwg.org/#dom-domimplementation-hasfeature
  document.implementation.hasFeature("", "") !== true;
}
/**
 * Checks if an event is supported in the current execution environment.
 *
 * NOTE: This will not work correctly for non-generic events such as `change`,
 * `reset`, `load`, `error`, and `select`.
 *
 * Borrows from Modernizr.
 *
 * @param {string} eventNameSuffix Event name, e.g. "click".
 * @param {?boolean} capture Check if the capture phase is supported.
 * @return {boolean} True if the event is supported.
 * @internal
 * @license Modernizr 3.0.0pre (Custom Build) | MIT
 */
function isEventSupported$1(eventNameSuffix, capture) {
  if (!ExecutionEnvironment.canUseDOM || capture && !("addEventListener" in document)) {
    return false;
  }
  var eventName = "on" + eventNameSuffix;
  var isSupported = eventName in document;
  if (!isSupported) {
    var element = document.createElement("div");
    element.setAttribute(eventName, "return;");
    isSupported = typeof element[eventName] === "function";
  }
  if (!isSupported && useHasFeature && eventNameSuffix === "wheel") {
    isSupported = document.implementation.hasFeature("Events.wheel", "3.0");
  }
  return isSupported;
}
var isEventSupported_1 = isEventSupported$1;
var UserAgent_DEPRECATED = UserAgent_DEPRECATED_1;
var isEventSupported = isEventSupported_1;
var PIXEL_STEP = 10;
var LINE_HEIGHT = 40;
var PAGE_HEIGHT = 800;
function normalizeWheel$2(event) {
  var sX = 0, sY = 0, pX = 0, pY = 0;
  if ("detail" in event) {
    sY = event.detail;
  }
  if ("wheelDelta" in event) {
    sY = -event.wheelDelta / 120;
  }
  if ("wheelDeltaY" in event) {
    sY = -event.wheelDeltaY / 120;
  }
  if ("wheelDeltaX" in event) {
    sX = -event.wheelDeltaX / 120;
  }
  if ("axis" in event && event.axis === event.HORIZONTAL_AXIS) {
    sX = sY;
    sY = 0;
  }
  pX = sX * PIXEL_STEP;
  pY = sY * PIXEL_STEP;
  if ("deltaY" in event) {
    pY = event.deltaY;
  }
  if ("deltaX" in event) {
    pX = event.deltaX;
  }
  if ((pX || pY) && event.deltaMode) {
    if (event.deltaMode == 1) {
      pX *= LINE_HEIGHT;
      pY *= LINE_HEIGHT;
    } else {
      pX *= PAGE_HEIGHT;
      pY *= PAGE_HEIGHT;
    }
  }
  if (pX && !sX) {
    sX = pX < 1 ? -1 : 1;
  }
  if (pY && !sY) {
    sY = pY < 1 ? -1 : 1;
  }
  return {
    spinX: sX,
    spinY: sY,
    pixelX: pX,
    pixelY: pY
  };
}
normalizeWheel$2.getEventType = function() {
  return UserAgent_DEPRECATED.firefox() ? "DOMMouseScroll" : isEventSupported("wheel") ? "wheel" : "mousewheel";
};
var normalizeWheel_1 = normalizeWheel$2;
var normalizeWheel = normalizeWheel_1;
const normalizeWheel$1 = /* @__PURE__ */ getDefaultExportFromCjs(normalizeWheel);
function getCropSize(mediaWidth, mediaHeight, containerWidth, containerHeight, aspect, rotation) {
  if (rotation === void 0) {
    rotation = 0;
  }
  var _a = rotateSize(mediaWidth, mediaHeight, rotation), width = _a.width, height = _a.height;
  var fittingWidth = Math.min(width, containerWidth);
  var fittingHeight = Math.min(height, containerHeight);
  if (fittingWidth > fittingHeight * aspect) {
    return {
      width: fittingHeight * aspect,
      height: fittingHeight
    };
  }
  return {
    width: fittingWidth,
    height: fittingWidth / aspect
  };
}
function getMediaZoom(mediaSize) {
  return mediaSize.width > mediaSize.height ? mediaSize.width / mediaSize.naturalWidth : mediaSize.height / mediaSize.naturalHeight;
}
function restrictPosition(position, mediaSize, cropSize, zoom, rotation) {
  if (rotation === void 0) {
    rotation = 0;
  }
  var _a = rotateSize(mediaSize.width, mediaSize.height, rotation), width = _a.width, height = _a.height;
  return {
    x: restrictPositionCoord(position.x, width, cropSize.width, zoom),
    y: restrictPositionCoord(position.y, height, cropSize.height, zoom)
  };
}
function restrictPositionCoord(position, mediaSize, cropSize, zoom) {
  var maxPosition = mediaSize * zoom / 2 - cropSize / 2;
  return clamp(position, -maxPosition, maxPosition);
}
function getDistanceBetweenPoints(pointA, pointB) {
  return Math.sqrt(Math.pow(pointA.y - pointB.y, 2) + Math.pow(pointA.x - pointB.x, 2));
}
function getRotationBetweenPoints(pointA, pointB) {
  return Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) * 180 / Math.PI;
}
function computeCroppedArea(crop, mediaSize, cropSize, aspect, zoom, rotation, restrictPosition2) {
  if (rotation === void 0) {
    rotation = 0;
  }
  if (restrictPosition2 === void 0) {
    restrictPosition2 = true;
  }
  var limitAreaFn = restrictPosition2 ? limitArea : noOp;
  var mediaBBoxSize = rotateSize(mediaSize.width, mediaSize.height, rotation);
  var mediaNaturalBBoxSize = rotateSize(mediaSize.naturalWidth, mediaSize.naturalHeight, rotation);
  var croppedAreaPercentages = {
    x: limitAreaFn(100, ((mediaBBoxSize.width - cropSize.width / zoom) / 2 - crop.x / zoom) / mediaBBoxSize.width * 100),
    y: limitAreaFn(100, ((mediaBBoxSize.height - cropSize.height / zoom) / 2 - crop.y / zoom) / mediaBBoxSize.height * 100),
    width: limitAreaFn(100, cropSize.width / mediaBBoxSize.width * 100 / zoom),
    height: limitAreaFn(100, cropSize.height / mediaBBoxSize.height * 100 / zoom)
  };
  var widthInPixels = Math.round(limitAreaFn(mediaNaturalBBoxSize.width, croppedAreaPercentages.width * mediaNaturalBBoxSize.width / 100));
  var heightInPixels = Math.round(limitAreaFn(mediaNaturalBBoxSize.height, croppedAreaPercentages.height * mediaNaturalBBoxSize.height / 100));
  var isImgWiderThanHigh = mediaNaturalBBoxSize.width >= mediaNaturalBBoxSize.height * aspect;
  var sizePixels = isImgWiderThanHigh ? {
    width: Math.round(heightInPixels * aspect),
    height: heightInPixels
  } : {
    width: widthInPixels,
    height: Math.round(widthInPixels / aspect)
  };
  var croppedAreaPixels = __assign(__assign({}, sizePixels), {
    x: Math.round(limitAreaFn(mediaNaturalBBoxSize.width - sizePixels.width, croppedAreaPercentages.x * mediaNaturalBBoxSize.width / 100)),
    y: Math.round(limitAreaFn(mediaNaturalBBoxSize.height - sizePixels.height, croppedAreaPercentages.y * mediaNaturalBBoxSize.height / 100))
  });
  return {
    croppedAreaPercentages,
    croppedAreaPixels
  };
}
function limitArea(max, value) {
  return Math.min(max, Math.max(0, value));
}
function noOp(_max, value) {
  return value;
}
function getInitialCropFromCroppedAreaPercentages(croppedAreaPercentages, mediaSize, rotation, cropSize, minZoom, maxZoom) {
  var mediaBBoxSize = rotateSize(mediaSize.width, mediaSize.height, rotation);
  var zoom = clamp(cropSize.width / mediaBBoxSize.width * (100 / croppedAreaPercentages.width), minZoom, maxZoom);
  var crop = {
    x: zoom * mediaBBoxSize.width / 2 - cropSize.width / 2 - mediaBBoxSize.width * zoom * (croppedAreaPercentages.x / 100),
    y: zoom * mediaBBoxSize.height / 2 - cropSize.height / 2 - mediaBBoxSize.height * zoom * (croppedAreaPercentages.y / 100)
  };
  return {
    crop,
    zoom
  };
}
function getZoomFromCroppedAreaPixels(croppedAreaPixels, mediaSize, cropSize) {
  var mediaZoom = getMediaZoom(mediaSize);
  return cropSize.height > cropSize.width ? cropSize.height / (croppedAreaPixels.height * mediaZoom) : cropSize.width / (croppedAreaPixels.width * mediaZoom);
}
function getInitialCropFromCroppedAreaPixels(croppedAreaPixels, mediaSize, rotation, cropSize, minZoom, maxZoom) {
  if (rotation === void 0) {
    rotation = 0;
  }
  var mediaNaturalBBoxSize = rotateSize(mediaSize.naturalWidth, mediaSize.naturalHeight, rotation);
  var zoom = clamp(getZoomFromCroppedAreaPixels(croppedAreaPixels, mediaSize, cropSize), minZoom, maxZoom);
  var cropZoom = cropSize.height > cropSize.width ? cropSize.height / croppedAreaPixels.height : cropSize.width / croppedAreaPixels.width;
  var crop = {
    x: ((mediaNaturalBBoxSize.width - croppedAreaPixels.width) / 2 - croppedAreaPixels.x) * cropZoom,
    y: ((mediaNaturalBBoxSize.height - croppedAreaPixels.height) / 2 - croppedAreaPixels.y) * cropZoom
  };
  return {
    crop,
    zoom
  };
}
function getCenter(a, b) {
  return {
    x: (b.x + a.x) / 2,
    y: (b.y + a.y) / 2
  };
}
function getRadianAngle(degreeValue) {
  return degreeValue * Math.PI / 180;
}
function rotateSize(width, height, rotation) {
  var rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height)
  };
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function classNames() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  return args.filter(function(value) {
    if (typeof value === "string" && value.length > 0) {
      return true;
    }
    return false;
  }).join(" ").trim();
}
var css_248z = ".reactEasyCrop_Container {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  overflow: hidden;\n  user-select: none;\n  touch-action: none;\n  cursor: move;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n.reactEasyCrop_Image,\n.reactEasyCrop_Video {\n  will-change: transform; /* this improves performances and prevent painting issues on iOS Chrome */\n}\n\n.reactEasyCrop_Contain {\n  max-width: 100%;\n  max-height: 100%;\n  margin: auto;\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  right: 0;\n}\n.reactEasyCrop_Cover_Horizontal {\n  width: 100%;\n  height: auto;\n}\n.reactEasyCrop_Cover_Vertical {\n  width: auto;\n  height: 100%;\n}\n\n.reactEasyCrop_CropArea {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  transform: translate(-50%, -50%);\n  border: 1px solid rgba(255, 255, 255, 0.5);\n  box-sizing: border-box;\n  box-shadow: 0 0 0 9999em;\n  color: rgba(0, 0, 0, 0.5);\n  overflow: hidden;\n}\n\n.reactEasyCrop_CropAreaRound {\n  border-radius: 50%;\n}\n\n.reactEasyCrop_CropAreaGrid::before {\n  content: ' ';\n  box-sizing: border-box;\n  position: absolute;\n  border: 1px solid rgba(255, 255, 255, 0.5);\n  top: 0;\n  bottom: 0;\n  left: 33.33%;\n  right: 33.33%;\n  border-top: 0;\n  border-bottom: 0;\n}\n\n.reactEasyCrop_CropAreaGrid::after {\n  content: ' ';\n  box-sizing: border-box;\n  position: absolute;\n  border: 1px solid rgba(255, 255, 255, 0.5);\n  top: 33.33%;\n  bottom: 33.33%;\n  left: 0;\n  right: 0;\n  border-left: 0;\n  border-right: 0;\n}\n";
var MIN_ZOOM = 1;
var MAX_ZOOM = 3;
var KEYBOARD_STEP = 1;
var Cropper = (
  /** @class */
  function(_super) {
    __extends(Cropper2, _super);
    function Cropper2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.cropperRef = reactExports.createRef();
      _this.imageRef = reactExports.createRef();
      _this.videoRef = reactExports.createRef();
      _this.containerPosition = {
        x: 0,
        y: 0
      };
      _this.containerRef = null;
      _this.styleRef = null;
      _this.containerRect = null;
      _this.mediaSize = {
        width: 0,
        height: 0,
        naturalWidth: 0,
        naturalHeight: 0
      };
      _this.dragStartPosition = {
        x: 0,
        y: 0
      };
      _this.dragStartCrop = {
        x: 0,
        y: 0
      };
      _this.gestureZoomStart = 0;
      _this.gestureRotationStart = 0;
      _this.isTouching = false;
      _this.lastPinchDistance = 0;
      _this.lastPinchRotation = 0;
      _this.rafDragTimeout = null;
      _this.rafPinchTimeout = null;
      _this.wheelTimer = null;
      _this.currentDoc = typeof document !== "undefined" ? document : null;
      _this.currentWindow = typeof window !== "undefined" ? window : null;
      _this.resizeObserver = null;
      _this.previousCropSize = null;
      _this.isInitialized = false;
      _this.state = {
        cropSize: null,
        hasWheelJustStarted: false,
        mediaObjectFit: void 0
      };
      _this.initResizeObserver = function() {
        if (typeof window.ResizeObserver === "undefined" || !_this.containerRef) {
          return;
        }
        var isFirstResize = true;
        _this.resizeObserver = new window.ResizeObserver(function(entries) {
          if (isFirstResize) {
            isFirstResize = false;
            return;
          }
          _this.computeSizes();
        });
        _this.resizeObserver.observe(_this.containerRef);
      };
      _this.preventZoomSafari = function(e) {
        return e.preventDefault();
      };
      _this.cleanEvents = function() {
        if (!_this.currentDoc) return;
        _this.currentDoc.removeEventListener("mousemove", _this.onMouseMove);
        _this.currentDoc.removeEventListener("mouseup", _this.onDragStopped);
        _this.currentDoc.removeEventListener("touchmove", _this.onTouchMove);
        _this.currentDoc.removeEventListener("touchend", _this.onDragStopped);
        _this.currentDoc.removeEventListener("gesturechange", _this.onGestureChange);
        _this.currentDoc.removeEventListener("gestureend", _this.onGestureEnd);
        _this.currentDoc.removeEventListener("scroll", _this.onScroll);
      };
      _this.clearScrollEvent = function() {
        if (_this.containerRef) _this.containerRef.removeEventListener("wheel", _this.onWheel);
        if (_this.wheelTimer) {
          clearTimeout(_this.wheelTimer);
        }
      };
      _this.onMediaLoad = function() {
        var cropSize = _this.computeSizes();
        if (cropSize) {
          _this.previousCropSize = cropSize;
          _this.emitCropData();
          _this.setInitialCrop(cropSize);
          _this.isInitialized = true;
        }
        if (_this.props.onMediaLoaded) {
          _this.props.onMediaLoaded(_this.mediaSize);
        }
      };
      _this.setInitialCrop = function(cropSize) {
        if (_this.props.initialCroppedAreaPercentages) {
          var _a = getInitialCropFromCroppedAreaPercentages(_this.props.initialCroppedAreaPercentages, _this.mediaSize, _this.props.rotation, cropSize, _this.props.minZoom, _this.props.maxZoom), crop = _a.crop, zoom = _a.zoom;
          _this.props.onCropChange(crop);
          _this.props.onZoomChange && _this.props.onZoomChange(zoom);
        } else if (_this.props.initialCroppedAreaPixels) {
          var _b = getInitialCropFromCroppedAreaPixels(_this.props.initialCroppedAreaPixels, _this.mediaSize, _this.props.rotation, cropSize, _this.props.minZoom, _this.props.maxZoom), crop = _b.crop, zoom = _b.zoom;
          _this.props.onCropChange(crop);
          _this.props.onZoomChange && _this.props.onZoomChange(zoom);
        }
      };
      _this.computeSizes = function() {
        var _a, _b, _c, _d, _e, _f;
        var mediaRef = _this.imageRef.current || _this.videoRef.current;
        if (mediaRef && _this.containerRef) {
          _this.containerRect = _this.containerRef.getBoundingClientRect();
          _this.saveContainerPosition();
          var containerAspect = _this.containerRect.width / _this.containerRect.height;
          var naturalWidth = ((_a = _this.imageRef.current) === null || _a === void 0 ? void 0 : _a.naturalWidth) || ((_b = _this.videoRef.current) === null || _b === void 0 ? void 0 : _b.videoWidth) || 0;
          var naturalHeight = ((_c = _this.imageRef.current) === null || _c === void 0 ? void 0 : _c.naturalHeight) || ((_d = _this.videoRef.current) === null || _d === void 0 ? void 0 : _d.videoHeight) || 0;
          var isMediaScaledDown = mediaRef.offsetWidth < naturalWidth || mediaRef.offsetHeight < naturalHeight;
          var mediaAspect = naturalWidth / naturalHeight;
          var renderedMediaSize = void 0;
          if (isMediaScaledDown) {
            switch (_this.state.mediaObjectFit) {
              default:
              case "contain":
                renderedMediaSize = containerAspect > mediaAspect ? {
                  width: _this.containerRect.height * mediaAspect,
                  height: _this.containerRect.height
                } : {
                  width: _this.containerRect.width,
                  height: _this.containerRect.width / mediaAspect
                };
                break;
              case "horizontal-cover":
                renderedMediaSize = {
                  width: _this.containerRect.width,
                  height: _this.containerRect.width / mediaAspect
                };
                break;
              case "vertical-cover":
                renderedMediaSize = {
                  width: _this.containerRect.height * mediaAspect,
                  height: _this.containerRect.height
                };
                break;
            }
          } else {
            renderedMediaSize = {
              width: mediaRef.offsetWidth,
              height: mediaRef.offsetHeight
            };
          }
          _this.mediaSize = __assign(__assign({}, renderedMediaSize), {
            naturalWidth,
            naturalHeight
          });
          if (_this.props.setMediaSize) {
            _this.props.setMediaSize(_this.mediaSize);
          }
          var cropSize = _this.props.cropSize ? _this.props.cropSize : getCropSize(_this.mediaSize.width, _this.mediaSize.height, _this.containerRect.width, _this.containerRect.height, _this.props.aspect, _this.props.rotation);
          if (((_e = _this.state.cropSize) === null || _e === void 0 ? void 0 : _e.height) !== cropSize.height || ((_f = _this.state.cropSize) === null || _f === void 0 ? void 0 : _f.width) !== cropSize.width) {
            _this.props.onCropSizeChange && _this.props.onCropSizeChange(cropSize);
          }
          _this.setState({
            cropSize
          }, _this.recomputeCropPosition);
          if (_this.props.setCropSize) {
            _this.props.setCropSize(cropSize);
          }
          return cropSize;
        }
      };
      _this.saveContainerPosition = function() {
        if (_this.containerRef) {
          var bounds = _this.containerRef.getBoundingClientRect();
          _this.containerPosition = {
            x: bounds.left,
            y: bounds.top
          };
        }
      };
      _this.onMouseDown = function(e) {
        if (!_this.currentDoc) return;
        e.preventDefault();
        _this.currentDoc.addEventListener("mousemove", _this.onMouseMove);
        _this.currentDoc.addEventListener("mouseup", _this.onDragStopped);
        _this.saveContainerPosition();
        _this.onDragStart(Cropper2.getMousePoint(e));
      };
      _this.onMouseMove = function(e) {
        return _this.onDrag(Cropper2.getMousePoint(e));
      };
      _this.onScroll = function(e) {
        if (!_this.currentDoc) return;
        e.preventDefault();
        _this.saveContainerPosition();
      };
      _this.onTouchStart = function(e) {
        if (!_this.currentDoc) return;
        _this.isTouching = true;
        if (_this.props.onTouchRequest && !_this.props.onTouchRequest(e)) {
          return;
        }
        _this.currentDoc.addEventListener("touchmove", _this.onTouchMove, {
          passive: false
        });
        _this.currentDoc.addEventListener("touchend", _this.onDragStopped);
        _this.saveContainerPosition();
        if (e.touches.length === 2) {
          _this.onPinchStart(e);
        } else if (e.touches.length === 1) {
          _this.onDragStart(Cropper2.getTouchPoint(e.touches[0]));
        }
      };
      _this.onTouchMove = function(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
          _this.onPinchMove(e);
        } else if (e.touches.length === 1) {
          _this.onDrag(Cropper2.getTouchPoint(e.touches[0]));
        }
      };
      _this.onGestureStart = function(e) {
        if (!_this.currentDoc) return;
        e.preventDefault();
        _this.currentDoc.addEventListener("gesturechange", _this.onGestureChange);
        _this.currentDoc.addEventListener("gestureend", _this.onGestureEnd);
        _this.gestureZoomStart = _this.props.zoom;
        _this.gestureRotationStart = _this.props.rotation;
      };
      _this.onGestureChange = function(e) {
        e.preventDefault();
        if (_this.isTouching) {
          return;
        }
        var point = Cropper2.getMousePoint(e);
        var newZoom = _this.gestureZoomStart - 1 + e.scale;
        _this.setNewZoom(newZoom, point, {
          shouldUpdatePosition: true
        });
        if (_this.props.onRotationChange) {
          var newRotation = _this.gestureRotationStart + e.rotation;
          _this.props.onRotationChange(newRotation);
        }
      };
      _this.onGestureEnd = function(e) {
        _this.cleanEvents();
      };
      _this.onDragStart = function(_a) {
        var _b, _c;
        var x = _a.x, y = _a.y;
        _this.dragStartPosition = {
          x,
          y
        };
        _this.dragStartCrop = __assign({}, _this.props.crop);
        (_c = (_b = _this.props).onInteractionStart) === null || _c === void 0 ? void 0 : _c.call(_b);
      };
      _this.onDrag = function(_a) {
        var x = _a.x, y = _a.y;
        if (!_this.currentWindow) return;
        if (_this.rafDragTimeout) _this.currentWindow.cancelAnimationFrame(_this.rafDragTimeout);
        _this.rafDragTimeout = _this.currentWindow.requestAnimationFrame(function() {
          if (!_this.state.cropSize) return;
          if (x === void 0 || y === void 0) return;
          var offsetX = x - _this.dragStartPosition.x;
          var offsetY = y - _this.dragStartPosition.y;
          var requestedPosition = {
            x: _this.dragStartCrop.x + offsetX,
            y: _this.dragStartCrop.y + offsetY
          };
          var newPosition = _this.props.restrictPosition ? restrictPosition(requestedPosition, _this.mediaSize, _this.state.cropSize, _this.props.zoom, _this.props.rotation) : requestedPosition;
          _this.props.onCropChange(newPosition);
        });
      };
      _this.onDragStopped = function() {
        var _a, _b;
        _this.isTouching = false;
        _this.cleanEvents();
        _this.emitCropData();
        (_b = (_a = _this.props).onInteractionEnd) === null || _b === void 0 ? void 0 : _b.call(_a);
      };
      _this.onWheel = function(e) {
        if (!_this.currentWindow) return;
        if (_this.props.onWheelRequest && !_this.props.onWheelRequest(e)) {
          return;
        }
        e.preventDefault();
        var point = Cropper2.getMousePoint(e);
        var pixelY = normalizeWheel$1(e).pixelY;
        var newZoom = _this.props.zoom - pixelY * _this.props.zoomSpeed / 200;
        _this.setNewZoom(newZoom, point, {
          shouldUpdatePosition: true
        });
        if (!_this.state.hasWheelJustStarted) {
          _this.setState({
            hasWheelJustStarted: true
          }, function() {
            var _a, _b;
            return (_b = (_a = _this.props).onInteractionStart) === null || _b === void 0 ? void 0 : _b.call(_a);
          });
        }
        if (_this.wheelTimer) {
          clearTimeout(_this.wheelTimer);
        }
        _this.wheelTimer = _this.currentWindow.setTimeout(function() {
          return _this.setState({
            hasWheelJustStarted: false
          }, function() {
            var _a, _b;
            return (_b = (_a = _this.props).onInteractionEnd) === null || _b === void 0 ? void 0 : _b.call(_a);
          });
        }, 250);
      };
      _this.getPointOnContainer = function(_a, containerTopLeft) {
        var x = _a.x, y = _a.y;
        if (!_this.containerRect) {
          throw new Error("The Cropper is not mounted");
        }
        return {
          x: _this.containerRect.width / 2 - (x - containerTopLeft.x),
          y: _this.containerRect.height / 2 - (y - containerTopLeft.y)
        };
      };
      _this.getPointOnMedia = function(_a) {
        var x = _a.x, y = _a.y;
        var _b = _this.props, crop = _b.crop, zoom = _b.zoom;
        return {
          x: (x + crop.x) / zoom,
          y: (y + crop.y) / zoom
        };
      };
      _this.setNewZoom = function(zoom, point, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.shouldUpdatePosition, shouldUpdatePosition = _c === void 0 ? true : _c;
        if (!_this.state.cropSize || !_this.props.onZoomChange) return;
        var newZoom = clamp(zoom, _this.props.minZoom, _this.props.maxZoom);
        if (shouldUpdatePosition) {
          var zoomPoint = _this.getPointOnContainer(point, _this.containerPosition);
          var zoomTarget = _this.getPointOnMedia(zoomPoint);
          var requestedPosition = {
            x: zoomTarget.x * newZoom - zoomPoint.x,
            y: zoomTarget.y * newZoom - zoomPoint.y
          };
          var newPosition = _this.props.restrictPosition ? restrictPosition(requestedPosition, _this.mediaSize, _this.state.cropSize, newZoom, _this.props.rotation) : requestedPosition;
          _this.props.onCropChange(newPosition);
        }
        _this.props.onZoomChange(newZoom);
      };
      _this.getCropData = function() {
        if (!_this.state.cropSize) {
          return null;
        }
        var restrictedPosition = _this.props.restrictPosition ? restrictPosition(_this.props.crop, _this.mediaSize, _this.state.cropSize, _this.props.zoom, _this.props.rotation) : _this.props.crop;
        return computeCroppedArea(restrictedPosition, _this.mediaSize, _this.state.cropSize, _this.getAspect(), _this.props.zoom, _this.props.rotation, _this.props.restrictPosition);
      };
      _this.emitCropData = function() {
        var cropData = _this.getCropData();
        if (!cropData) return;
        var croppedAreaPercentages = cropData.croppedAreaPercentages, croppedAreaPixels = cropData.croppedAreaPixels;
        if (_this.props.onCropComplete) {
          _this.props.onCropComplete(croppedAreaPercentages, croppedAreaPixels);
        }
        if (_this.props.onCropAreaChange) {
          _this.props.onCropAreaChange(croppedAreaPercentages, croppedAreaPixels);
        }
      };
      _this.emitCropAreaChange = function() {
        var cropData = _this.getCropData();
        if (!cropData) return;
        var croppedAreaPercentages = cropData.croppedAreaPercentages, croppedAreaPixels = cropData.croppedAreaPixels;
        if (_this.props.onCropAreaChange) {
          _this.props.onCropAreaChange(croppedAreaPercentages, croppedAreaPixels);
        }
      };
      _this.recomputeCropPosition = function() {
        var _a, _b;
        if (!_this.state.cropSize) return;
        var adjustedCrop = _this.props.crop;
        if (_this.isInitialized && ((_a = _this.previousCropSize) === null || _a === void 0 ? void 0 : _a.width) && ((_b = _this.previousCropSize) === null || _b === void 0 ? void 0 : _b.height)) {
          var sizeChanged = Math.abs(_this.previousCropSize.width - _this.state.cropSize.width) > 1e-6 || Math.abs(_this.previousCropSize.height - _this.state.cropSize.height) > 1e-6;
          if (sizeChanged) {
            var scaleX = _this.state.cropSize.width / _this.previousCropSize.width;
            var scaleY = _this.state.cropSize.height / _this.previousCropSize.height;
            adjustedCrop = {
              x: _this.props.crop.x * scaleX,
              y: _this.props.crop.y * scaleY
            };
          }
        }
        var newPosition = _this.props.restrictPosition ? restrictPosition(adjustedCrop, _this.mediaSize, _this.state.cropSize, _this.props.zoom, _this.props.rotation) : adjustedCrop;
        _this.previousCropSize = _this.state.cropSize;
        _this.props.onCropChange(newPosition);
        _this.emitCropData();
      };
      _this.onKeyDown = function(event) {
        var _a, _b;
        var _c = _this.props, crop = _c.crop, onCropChange = _c.onCropChange, keyboardStep = _c.keyboardStep, zoom = _c.zoom, rotation = _c.rotation;
        var step = keyboardStep;
        if (!_this.state.cropSize) return;
        if (event.shiftKey) {
          step *= 0.2;
        }
        var newCrop = __assign({}, crop);
        switch (event.key) {
          case "ArrowUp":
            newCrop.y -= step;
            event.preventDefault();
            break;
          case "ArrowDown":
            newCrop.y += step;
            event.preventDefault();
            break;
          case "ArrowLeft":
            newCrop.x -= step;
            event.preventDefault();
            break;
          case "ArrowRight":
            newCrop.x += step;
            event.preventDefault();
            break;
          default:
            return;
        }
        if (_this.props.restrictPosition) {
          newCrop = restrictPosition(newCrop, _this.mediaSize, _this.state.cropSize, zoom, rotation);
        }
        if (!event.repeat) {
          (_b = (_a = _this.props).onInteractionStart) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        onCropChange(newCrop);
      };
      _this.onKeyUp = function(event) {
        var _a, _b;
        switch (event.key) {
          case "ArrowUp":
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight":
            event.preventDefault();
            break;
          default:
            return;
        }
        _this.emitCropData();
        (_b = (_a = _this.props).onInteractionEnd) === null || _b === void 0 ? void 0 : _b.call(_a);
      };
      return _this;
    }
    Cropper2.prototype.componentDidMount = function() {
      if (!this.currentDoc || !this.currentWindow) return;
      if (this.containerRef) {
        if (this.containerRef.ownerDocument) {
          this.currentDoc = this.containerRef.ownerDocument;
        }
        if (this.currentDoc.defaultView) {
          this.currentWindow = this.currentDoc.defaultView;
        }
        this.initResizeObserver();
        if (typeof window.ResizeObserver === "undefined") {
          this.currentWindow.addEventListener("resize", this.computeSizes);
        }
        this.props.zoomWithScroll && this.containerRef.addEventListener("wheel", this.onWheel, {
          passive: false
        });
        this.containerRef.addEventListener("gesturestart", this.onGestureStart);
      }
      this.currentDoc.addEventListener("scroll", this.onScroll);
      if (!this.props.disableAutomaticStylesInjection) {
        this.styleRef = this.currentDoc.createElement("style");
        this.styleRef.setAttribute("type", "text/css");
        if (this.props.nonce) {
          this.styleRef.setAttribute("nonce", this.props.nonce);
        }
        this.styleRef.innerHTML = css_248z;
        this.currentDoc.head.appendChild(this.styleRef);
      }
      if (this.imageRef.current && this.imageRef.current.complete) {
        this.onMediaLoad();
      }
      if (this.props.setImageRef) {
        this.props.setImageRef(this.imageRef);
      }
      if (this.props.setVideoRef) {
        this.props.setVideoRef(this.videoRef);
      }
      if (this.props.setCropperRef) {
        this.props.setCropperRef(this.cropperRef);
      }
    };
    Cropper2.prototype.componentWillUnmount = function() {
      var _a, _b;
      if (!this.currentDoc || !this.currentWindow) return;
      if (typeof window.ResizeObserver === "undefined") {
        this.currentWindow.removeEventListener("resize", this.computeSizes);
      }
      (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
      if (this.containerRef) {
        this.containerRef.removeEventListener("gesturestart", this.preventZoomSafari);
      }
      if (this.styleRef) {
        (_b = this.styleRef.parentNode) === null || _b === void 0 ? void 0 : _b.removeChild(this.styleRef);
      }
      this.cleanEvents();
      this.props.zoomWithScroll && this.clearScrollEvent();
    };
    Cropper2.prototype.componentDidUpdate = function(prevProps) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j;
      if (prevProps.rotation !== this.props.rotation) {
        this.computeSizes();
        this.recomputeCropPosition();
      } else if (prevProps.aspect !== this.props.aspect) {
        this.computeSizes();
      } else if (prevProps.objectFit !== this.props.objectFit) {
        this.computeSizes();
      } else if (prevProps.zoom !== this.props.zoom) {
        this.recomputeCropPosition();
      } else if (((_a = prevProps.cropSize) === null || _a === void 0 ? void 0 : _a.height) !== ((_b = this.props.cropSize) === null || _b === void 0 ? void 0 : _b.height) || ((_c = prevProps.cropSize) === null || _c === void 0 ? void 0 : _c.width) !== ((_d = this.props.cropSize) === null || _d === void 0 ? void 0 : _d.width)) {
        this.computeSizes();
      } else if (((_e = prevProps.crop) === null || _e === void 0 ? void 0 : _e.x) !== ((_f = this.props.crop) === null || _f === void 0 ? void 0 : _f.x) || ((_g = prevProps.crop) === null || _g === void 0 ? void 0 : _g.y) !== ((_h = this.props.crop) === null || _h === void 0 ? void 0 : _h.y)) {
        this.emitCropAreaChange();
      }
      if (prevProps.zoomWithScroll !== this.props.zoomWithScroll && this.containerRef) {
        this.props.zoomWithScroll ? this.containerRef.addEventListener("wheel", this.onWheel, {
          passive: false
        }) : this.clearScrollEvent();
      }
      if (prevProps.video !== this.props.video) {
        (_j = this.videoRef.current) === null || _j === void 0 ? void 0 : _j.load();
      }
      var objectFit = this.getObjectFit();
      if (objectFit !== this.state.mediaObjectFit) {
        this.setState({
          mediaObjectFit: objectFit
        }, this.computeSizes);
      }
    };
    Cropper2.prototype.getAspect = function() {
      var _a = this.props, cropSize = _a.cropSize, aspect = _a.aspect;
      if (cropSize) {
        return cropSize.width / cropSize.height;
      }
      return aspect;
    };
    Cropper2.prototype.getObjectFit = function() {
      var _a, _b, _c, _d;
      if (this.props.objectFit === "cover") {
        var mediaRef = this.imageRef.current || this.videoRef.current;
        if (mediaRef && this.containerRef) {
          this.containerRect = this.containerRef.getBoundingClientRect();
          var containerAspect = this.containerRect.width / this.containerRect.height;
          var naturalWidth = ((_a = this.imageRef.current) === null || _a === void 0 ? void 0 : _a.naturalWidth) || ((_b = this.videoRef.current) === null || _b === void 0 ? void 0 : _b.videoWidth) || 0;
          var naturalHeight = ((_c = this.imageRef.current) === null || _c === void 0 ? void 0 : _c.naturalHeight) || ((_d = this.videoRef.current) === null || _d === void 0 ? void 0 : _d.videoHeight) || 0;
          var mediaAspect = naturalWidth / naturalHeight;
          return mediaAspect < containerAspect ? "horizontal-cover" : "vertical-cover";
        }
        return "horizontal-cover";
      }
      return this.props.objectFit;
    };
    Cropper2.prototype.onPinchStart = function(e) {
      var pointA = Cropper2.getTouchPoint(e.touches[0]);
      var pointB = Cropper2.getTouchPoint(e.touches[1]);
      this.lastPinchDistance = getDistanceBetweenPoints(pointA, pointB);
      this.lastPinchRotation = getRotationBetweenPoints(pointA, pointB);
      this.onDragStart(getCenter(pointA, pointB));
    };
    Cropper2.prototype.onPinchMove = function(e) {
      var _this = this;
      if (!this.currentDoc || !this.currentWindow) return;
      var pointA = Cropper2.getTouchPoint(e.touches[0]);
      var pointB = Cropper2.getTouchPoint(e.touches[1]);
      var center = getCenter(pointA, pointB);
      this.onDrag(center);
      if (this.rafPinchTimeout) this.currentWindow.cancelAnimationFrame(this.rafPinchTimeout);
      this.rafPinchTimeout = this.currentWindow.requestAnimationFrame(function() {
        var distance = getDistanceBetweenPoints(pointA, pointB);
        var newZoom = _this.props.zoom * (distance / _this.lastPinchDistance);
        _this.setNewZoom(newZoom, center, {
          shouldUpdatePosition: false
        });
        _this.lastPinchDistance = distance;
        var rotation = getRotationBetweenPoints(pointA, pointB);
        var newRotation = _this.props.rotation + (rotation - _this.lastPinchRotation);
        _this.props.onRotationChange && _this.props.onRotationChange(newRotation);
        _this.lastPinchRotation = rotation;
      });
    };
    Cropper2.prototype.render = function() {
      var _this = this;
      var _a;
      var _b = this.props, image = _b.image, video = _b.video, mediaProps = _b.mediaProps, cropperProps = _b.cropperProps, transform = _b.transform, _c = _b.crop, x = _c.x, y = _c.y, rotation = _b.rotation, zoom = _b.zoom, cropShape = _b.cropShape, showGrid = _b.showGrid, roundCropAreaPixels = _b.roundCropAreaPixels, _d = _b.style, containerStyle = _d.containerStyle, cropAreaStyle = _d.cropAreaStyle, mediaStyle = _d.mediaStyle, _e = _b.classes, containerClassName = _e.containerClassName, cropAreaClassName = _e.cropAreaClassName, mediaClassName = _e.mediaClassName;
      var objectFit = (_a = this.state.mediaObjectFit) !== null && _a !== void 0 ? _a : this.getObjectFit();
      return reactExports.createElement("div", {
        onMouseDown: this.onMouseDown,
        onTouchStart: this.onTouchStart,
        ref: function ref(el) {
          return _this.containerRef = el;
        },
        "data-testid": "container",
        style: containerStyle,
        className: classNames("reactEasyCrop_Container", containerClassName)
      }, image ? reactExports.createElement("img", __assign({
        alt: "",
        className: classNames("reactEasyCrop_Image", objectFit === "contain" && "reactEasyCrop_Contain", objectFit === "horizontal-cover" && "reactEasyCrop_Cover_Horizontal", objectFit === "vertical-cover" && "reactEasyCrop_Cover_Vertical", mediaClassName)
      }, mediaProps, {
        src: image,
        ref: this.imageRef,
        style: __assign(__assign({}, mediaStyle), {
          transform: transform || "translate(".concat(x, "px, ").concat(y, "px) rotate(").concat(rotation, "deg) scale(").concat(zoom, ")")
        }),
        onLoad: this.onMediaLoad
      })) : video && reactExports.createElement("video", __assign({
        autoPlay: true,
        playsInline: true,
        loop: true,
        muted: true,
        className: classNames("reactEasyCrop_Video", objectFit === "contain" && "reactEasyCrop_Contain", objectFit === "horizontal-cover" && "reactEasyCrop_Cover_Horizontal", objectFit === "vertical-cover" && "reactEasyCrop_Cover_Vertical", mediaClassName)
      }, mediaProps, {
        ref: this.videoRef,
        onLoadedMetadata: this.onMediaLoad,
        style: __assign(__assign({}, mediaStyle), {
          transform: transform || "translate(".concat(x, "px, ").concat(y, "px) rotate(").concat(rotation, "deg) scale(").concat(zoom, ")")
        }),
        controls: false
      }), (Array.isArray(video) ? video : [{
        src: video
      }]).map(function(item) {
        return reactExports.createElement("source", __assign({
          key: item.src
        }, item));
      })), this.state.cropSize && reactExports.createElement("div", __assign({
        ref: this.cropperRef,
        style: __assign(__assign({}, cropAreaStyle), {
          width: roundCropAreaPixels ? Math.round(this.state.cropSize.width) : this.state.cropSize.width,
          height: roundCropAreaPixels ? Math.round(this.state.cropSize.height) : this.state.cropSize.height
        }),
        tabIndex: 0,
        onKeyDown: this.onKeyDown,
        onKeyUp: this.onKeyUp,
        "data-testid": "cropper",
        className: classNames("reactEasyCrop_CropArea", cropShape === "round" && "reactEasyCrop_CropAreaRound", showGrid && "reactEasyCrop_CropAreaGrid", cropAreaClassName)
      }, cropperProps)));
    };
    Cropper2.defaultProps = {
      zoom: 1,
      rotation: 0,
      aspect: 4 / 3,
      maxZoom: MAX_ZOOM,
      minZoom: MIN_ZOOM,
      cropShape: "rect",
      objectFit: "contain",
      showGrid: true,
      style: {},
      classes: {},
      mediaProps: {},
      cropperProps: {},
      zoomSpeed: 1,
      restrictPosition: true,
      zoomWithScroll: true,
      keyboardStep: KEYBOARD_STEP
    };
    Cropper2.getMousePoint = function(e) {
      return {
        x: Number(e.clientX),
        y: Number(e.clientY)
      };
    };
    Cropper2.getTouchPoint = function(touch) {
      return {
        x: Number(touch.clientX),
        y: Number(touch.clientY)
      };
    };
    return Cropper2;
  }(reactExports.Component)
);
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}
function ImageCropper({ imageSrc, onCancel, onSave }) {
  const [crop, setCrop] = reactExports.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = reactExports.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = reactExports.useState(null);
  const [saving, setSaving] = reactExports.useState(false);
  const onCropComplete = reactExports.useCallback((croppedArea, croppedAreaPixels2) => {
    setCroppedAreaPixels(croppedAreaPixels2);
  }, []);
  reactExports.useEffect(() => {
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return void 0;
    const previousOverflow = mainContent.style.overflowY;
    const previousOverscroll = mainContent.style.overscrollBehavior;
    mainContent.style.overflowY = "hidden";
    mainContent.style.overscrollBehavior = "contain";
    return () => {
      mainContent.style.overflowY = previousOverflow;
      mainContent.style.overscrollBehavior = previousOverscroll;
    };
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(croppedImage);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };
  return ReactDOM.createPortal(
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "cropper-overlay",
        onClick: (e) => {
          if (e.target === e.currentTarget && !saving) {
            onCancel?.();
          }
        },
        onWheel: (e) => e.preventDefault(),
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cropper-container", onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "cropper-header", children: /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "🖼️ 编辑头像" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "cropper-area", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            Cropper,
            {
              image: imageSrc,
              crop,
              zoom,
              aspect: 3 / 4,
              onCropChange: setCrop,
              onCropComplete,
              onZoomChange: setZoom,
              showGrid: false
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cropper-controls", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "zoom-slider-container", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { role: "img", "aria-label": "zoom-out", children: "➖" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "range",
                  value: zoom,
                  min: 1,
                  max: 3,
                  step: 0.1,
                  "aria-labelledby": "Zoom",
                  onChange: (e) => setZoom(e.target.value),
                  className: "zoom-slider"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { role: "img", "aria-label": "zoom-in", children: "➕" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cropper-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "btn btn-secondary",
                  onClick: onCancel,
                  disabled: saving,
                  children: "取消"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "btn btn-primary",
                  onClick: handleSave,
                  disabled: saving,
                  children: saving ? "保存中..." : "确认并剪裁"
                }
              )
            ] })
          ] })
        ] })
      }
    ),
    document.body
  );
}
let _pinyin = null;
const pinyinReady = __vitePreload(() => import("./pinyin.js"), true ? [] : void 0, import.meta.url).then((mod) => {
  _pinyin = mod.pinyin;
});
const INTEGRATED_PACKAGE_DOWNLOAD_URL = "https://www.qaqm.top/download";
const INTEGRATED_PACKAGE_EXTRACTOR_URL = "https://pan.quark.cn/s/64155f7ee7ea";
function normalizeLegacyPreview(preview) {
  return {
    token: preview?.token || "",
    hasCandidates: !!preview?.hasCandidates,
    categoryCount: Number(preview?.categoryCount || 0),
    modCount: Number(preview?.modCount || 0),
    sourceRoots: Array.isArray(preview?.sourceRoots) ? preview.sourceRoots : [],
    targetCharacters: Array.isArray(preview?.targetCharacters) ? preview.targetCharacters : [],
    previewMoves: Array.isArray(preview?.previewMoves) ? preview.previewMoves : []
  };
}
function isSameLegacyPreview(left, right) {
  return JSON.stringify(normalizeLegacyPreview(left)) === JSON.stringify(normalizeLegacyPreview(right));
}
function normalizeSearchValue(value) {
  return String(value || "").toLowerCase().replace(/[\s·.。・'"“”‘’`~!@#$%^&*()_+=\-/{},.:;<>?\\|\[\]]+/g, "").trim();
}
function getCharacterSkinCount(character) {
  return Number(character?.skinCount ?? character?.officialSkinCount ?? 0) || 0;
}
function getCharacterUsageStorageKey(gameId) {
  return `charview-usage-${gameId || "default"}`;
}
function getCharacterPinnedStorageKey(gameId) {
  return `charview-pinned-${gameId || "default"}`;
}
function readCharacterPinnedSet(gameId) {
  try {
    const raw = localStorage.getItem(getCharacterPinnedStorageKey(gameId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function writeCharacterPinnedSet(gameId, pinnedSet) {
  try {
    localStorage.setItem(getCharacterPinnedStorageKey(gameId), JSON.stringify(Array.from(pinnedSet)));
  } catch {
  }
}
function getCharacterCustomOrderKey(gameId) {
  return `charview-custom-order-${gameId || "default"}`;
}
function getCharacterShowAllStorageKey(gameId) {
  return `charview-show-all-characters-${gameId || "default"}`;
}
function readCharacterShowAll(gameId) {
  try {
    const raw = localStorage.getItem(getCharacterShowAllStorageKey(gameId));
    return raw === null ? true : raw !== "false";
  } catch {
    return true;
  }
}
function isCoverImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "");
  const name = String(file.name || file.path || "");
  return type.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name);
}
function isBatchFolderPlanItem(item) {
  return !!item?.importPlan && Array.isArray(item.importPlan?.splitOptions);
}
function getPlanSelectedMode(item) {
  return item?.selectedImportMode || item?.importPlan?.defaultMode || "single";
}
function normalizeImportDisplayPart(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}
function joinImportDisplayPath(...parts) {
  return parts.map(normalizeImportDisplayPart).filter(Boolean).join("/");
}
function getBatchImportDisplayPath(item, fallbackRootName = "") {
  if (!item) return "";
  if (item.importDisplayPath) return item.importDisplayPath;
  const rootName = fallbackRootName || item.importPlanRootName || item.importRootName || "";
  const relativePath = item.importRelativePath || "";
  return joinImportDisplayPath(rootName, relativePath) || normalizeImportDisplayPart(relativePath) || item.name || "";
}
function decorateBatchImportItem(item, rootName = "") {
  if (!item) return item;
  const displayPath = getBatchImportDisplayPath(item, rootName);
  return {
    ...item,
    importPlanRootName: rootName || item.importPlanRootName || item.importRootName || "",
    importDisplayPath: displayPath
  };
}
function getSelectedBatchPlanItems(item) {
  if (!isBatchFolderPlanItem(item)) return [decorateBatchImportItem(item)];
  const plan = item.importPlan;
  const rootName = plan.rootName || item.name || "";
  const mode = getPlanSelectedMode(item);
  const applyPreferredName = (entry) => mode === "single" && item.preferredModName ? { ...entry, name: item.preferredModName, preferredModName: item.preferredModName } : entry;
  if (mode === "integrated") {
    const option = (plan.integratedOptions || []).find((entry) => entry.id === item.selectedIntegratedOptionId) || (plan.integratedOptions || []).find((entry) => entry.id === plan.defaultIntegratedOptionId) || (plan.integratedOptions || [])[0];
    return option?.item ? [decorateBatchImportItem({ ...option.item, selected: item.selected !== false && option.item.selected !== false }, rootName)] : [decorateBatchImportItem({ ...plan.wholeItem, selected: item.selected !== false && plan.wholeItem?.selected !== false }, rootName)];
  }
  if (mode === "multiple") {
    const option = (plan.splitOptions || []).find((entry) => entry.id === item.selectedSplitOptionId) || (plan.splitOptions || []).find((entry) => entry.id === plan.defaultSplitOptionId) || (plan.splitOptions || [])[0];
    return (option?.items?.length ? option.items : [plan.wholeItem]).map((entry) => ({
      ...decorateBatchImportItem(entry, rootName),
      selected: item.selected !== false && entry.selected !== false
    }));
  }
  return [applyPreferredName(decorateBatchImportItem({ ...plan.wholeItem, selected: item.selected !== false && plan.wholeItem?.selected !== false }, rootName))];
}
function expandBatchPlanItems(items) {
  return (items || []).flatMap((item) => getSelectedBatchPlanItems(item));
}
function getBatchPlanModeLabel(mode) {
  if (mode === "integrated") return "整合包";
  if (mode === "multiple") return "多个 Mod";
  return "单个 Mod";
}
function dataTransferIncludesCoverImage(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => {
      const type = String(item.type || "");
      if (type.startsWith("image/")) return true;
      const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      return isCoverImageFile(file);
    });
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files).some(isCoverImageFile);
  }
  return false;
}
function readNevernessModeFallback(activeGame) {
  if (activeGame?.id !== "neverness-to-everness") return null;
  try {
    const cachedMode = localStorage.getItem("neverness-mod-mode");
    if (cachedMode === "dx12" || cachedMode === "nemi") return cachedMode;
  } catch {
  }
  return activeGame?.launchMode === "DX12" ? "dx12" : "nemi";
}
function LegacyImportModal({ preview, migrating, onClose, onMigrate }) {
  if (!preview?.hasCandidates) return null;
  const targetPreview = preview.targetCharacters.slice(0, 6);
  const movePreview = preview.previewMoves.slice(0, 4);
  return ReactDOM.createPortal(
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-overlay", onClick: () => !migrating && onClose?.(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-card", onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-hero", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "legacy-import-badge", children: "角色整理助手" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "legacy-import-close", onClick: () => !migrating && onClose?.(), disabled: migrating, children: "✕" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-hero-main", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "legacy-import-hero-icon", children: "🪄" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "发现还没归类好的 Mod" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
                "检测到 ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: preview.categoryCount }),
                " 个旧分类目录，",
                preview.modCount > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  "里面有 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: preview.modCount }),
                  " 个真实 Mod 文件夹可以帮你整理到中文角色目录。"
                ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: "可以帮你把旧的空分类目录整理到正确角色目录。" })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-body", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "legacy-import-note", children: "只会移动分类目录里的真实 Mod 文件夹；如果只是空的旧分类目录，会清理掉旧目录，不会删除 Mod 内容，也不会覆盖同名目录。" }),
          targetPreview.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-section", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "legacy-import-label", children: "准备整理到这些角色" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-tags", children: [
              targetPreview.map((name) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "legacy-import-tag", children: name }, name)),
              preview.targetCharacters.length > targetPreview.length && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "legacy-import-tag muted", children: [
                "+",
                preview.targetCharacters.length - targetPreview.length
              ] })
            ] })
          ] }),
          movePreview.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-section", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "legacy-import-label", children: "示例搬运" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "legacy-import-list", children: movePreview.map((item, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-list-item", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "legacy-import-source", children: item.sourceCategoryName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "legacy-import-arrow", children: "→" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "legacy-import-target", children: item.targetDisplayName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "legacy-import-mod", children: item.modName })
            ] }, `${item.sourceCategoryName}-${item.modName}-${index}`)) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "legacy-import-actions", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: onClose, disabled: migrating, children: "先不处理" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-primary", onClick: onMigrate, disabled: migrating, children: migrating ? "整理中..." : "确认整理" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("style", { children: `
                .legacy-import-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 1500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: rgba(15, 23, 42, 0.52);
                    backdrop-filter: blur(12px);
                    animation: fadeIn 0.18s ease-out;
                }

                .legacy-import-card {
                    width: min(720px, 100%);
                    border-radius: 28px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.97);
                    border: 1px solid rgba(255, 255, 255, 0.9);
                    box-shadow: 0 32px 70px rgba(15, 23, 42, 0.22);
                }

                .legacy-import-hero {
                    position: relative;
                    padding: 24px 26px 22px;
                    background: linear-gradient(135deg, rgba(255, 196, 214, 0.95), rgba(255, 233, 182, 0.92));
                }

                .legacy-import-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.72);
                    color: #9d174d;
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.03em;
                }

                .legacy-import-close {
                    position: absolute;
                    top: 18px;
                    right: 18px;
                    width: 38px;
                    height: 38px;
                    border: none;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.72);
                    color: #6b7280;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.18s ease;
                }

                .legacy-import-close:hover:not(:disabled) {
                    background: rgba(255,255,255,0.95);
                    color: #111827;
                }

                .legacy-import-close:disabled {
                    cursor: not-allowed;
                    opacity: 0.6;
                }

                .legacy-import-hero-main {
                    margin-top: 16px;
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                }

                .legacy-import-hero-icon {
                    width: 58px;
                    height: 58px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.7);
                    font-size: 28px;
                    flex-shrink: 0;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.65);
                }

                .legacy-import-hero h2 {
                    margin: 4px 0 10px;
                    font-size: 28px;
                    color: #1f2937;
                }

                .legacy-import-hero p {
                    margin: 0;
                    color: rgba(31, 41, 55, 0.82);
                    line-height: 1.8;
                    font-size: 14px;
                }

                .legacy-import-body {
                    padding: 22px 26px 26px;
                    display: grid;
                    gap: 16px;
                }

                .legacy-import-note {
                    padding: 14px 16px;
                    border-radius: 16px;
                    background: rgba(255, 247, 237, 0.92);
                    border: 1px solid rgba(251, 191, 36, 0.2);
                    color: #9a3412;
                    font-size: 13px;
                    line-height: 1.75;
                }

                .legacy-import-section {
                    display: grid;
                    gap: 10px;
                }

                .legacy-import-label {
                    font-size: 13px;
                    font-weight: 700;
                    color: #374151;
                }

                .legacy-import-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .legacy-import-tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 12px;
                    border-radius: 999px;
                    background: rgba(244, 114, 182, 0.08);
                    color: #be185d;
                    font-size: 12px;
                    font-weight: 600;
                }

                .legacy-import-tag.muted {
                    background: rgba(148, 163, 184, 0.12);
                    color: #475569;
                }

                .legacy-import-list {
                    display: grid;
                    gap: 10px;
                }

                .legacy-import-list-item {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 1.2fr);
                    gap: 10px;
                    align-items: center;
                    padding: 12px 14px;
                    border-radius: 16px;
                    background: rgba(248, 250, 252, 0.96);
                    border: 1px solid rgba(226, 232, 240, 0.9);
                    font-size: 12px;
                }

                .legacy-import-source,
                .legacy-import-target,
                .legacy-import-mod {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .legacy-import-source {
                    color: #6366f1;
                    font-weight: 600;
                }

                .legacy-import-target {
                    color: #db2777;
                    font-weight: 600;
                }

                .legacy-import-mod {
                    color: #475569;
                    text-align: right;
                }

                .legacy-import-arrow {
                    color: #f97316;
                    font-weight: 800;
                }

                .legacy-import-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding-top: 6px;
                }

                @media (max-width: 640px) {
                    .legacy-import-overlay {
                        padding: 16px;
                    }

                    .legacy-import-hero,
                    .legacy-import-body {
                        padding-left: 18px;
                        padding-right: 18px;
                    }

                    .legacy-import-hero-main {
                        flex-direction: column;
                    }

                    .legacy-import-list-item {
                        grid-template-columns: 1fr;
                    }

                    .legacy-import-mod {
                        text-align: left;
                    }

                    .legacy-import-actions {
                        flex-direction: column-reverse;
                    }

                    .legacy-import-actions .btn {
                        width: 100%;
                    }
                }
            ` })
    ] }),
    document.body
  );
}
function CharacterView({ activeGame, initialCache, onCacheChange, onSelectCharacter, onOpenSettings, pendingBatchItems, pendingBatchPreferredCharacter, onPendingBatchConsumed, pendingMoveMod, onCancelPendingMove, onPendingMoveCompleted }) {
  const [characters, setCharacters] = reactExports.useState(() => Array.isArray(initialCache?.characters) ? initialCache.characters : []);
  const [characterCovers, setCharacterCovers] = reactExports.useState(() => initialCache?.characterCovers || {});
  const [loading, setLoading] = reactExports.useState(() => !initialCache);
  const [initialized, setInitialized] = reactExports.useState(() => !!initialCache);
  const [missingPath, setMissingPath] = reactExports.useState(() => !!initialCache?.missingPath);
  const [loadError, setLoadError] = reactExports.useState(() => initialCache?.loadError || "");
  const [showAddModal, setShowAddModal] = reactExports.useState(false);
  const [showDeleteModal, setShowDeleteModal] = reactExports.useState(null);
  const [showHiddenCharacters, setShowHiddenCharacters] = reactExports.useState(false);
  const [hiddenCharacterCount, setHiddenCharacterCount] = reactExports.useState(0);
  const [hidingCharacter, setHidingCharacter] = reactExports.useState(false);
  const [newCharName, setNewCharName] = reactExports.useState("");
  const [toast, setToast] = reactExports.useState(null);
  const [draggingOver, setDraggingOver] = reactExports.useState(null);
  const [legacyImportPreview, setLegacyImportPreview] = reactExports.useState(() => initialCache?.legacyImportPreview || null);
  const [legacyPromptDismissed, setLegacyPromptDismissed] = reactExports.useState(() => !!initialCache?.legacyPromptDismissed);
  const [migratingLegacyImport, setMigratingLegacyImport] = reactExports.useState(false);
  const [looseRootFolders, setLooseRootFolders] = reactExports.useState(() => initialCache?.looseRootFolders || null);
  const [misplacedModFolders, setMisplacedModFolders] = reactExports.useState(() => initialCache?.misplacedModFolders || null);
  const [quarantiningLooseRoot, setQuarantiningLooseRoot] = reactExports.useState(false);
  const [showLooseRootReview, setShowLooseRootReview] = reactExports.useState(false);
  const [selectedLooseRootItemIds, setSelectedLooseRootItemIds] = reactExports.useState(() => /* @__PURE__ */ new Set());
  const [selectedMisplacedItemIds, setSelectedMisplacedItemIds] = reactExports.useState(() => /* @__PURE__ */ new Set());
  const [refreshingCharacters, setRefreshingCharacters] = reactExports.useState(false);
  const [searchQuery, setSearchQuery] = reactExports.useState("");
  const [sortMethod, setSortMethod] = reactExports.useState(() => {
    try {
      return localStorage.getItem(`charview-sort-${activeGame?.id || "default"}`) || "common";
    } catch {
      return "common";
    }
  });
  const [showReorderHint, setShowReorderHint] = reactExports.useState(false);
  const [customOrderActive, setCustomOrderActive] = reactExports.useState(() => {
    try {
      return localStorage.getItem(getCharacterCustomOrderKey(activeGame?.id)) === "true";
    } catch {
      return false;
    }
  });
  const [batchImport, setBatchImport] = reactExports.useState(null);
  const [batchCharacterPickerPosition, setBatchCharacterPickerPosition] = reactExports.useState(null);
  const [showBatchGuide, setShowBatchGuide] = reactExports.useState(false);
  const [showIntegratedPackageGuide, setShowIntegratedPackageGuide] = reactExports.useState(false);
  const inputRef = reactExports.useRef(null);
  const latestPreviewRef = reactExports.useRef(null);
  const [draggedChar, setDraggedChar] = reactExports.useState(null);
  const [dragOverChar, setDragOverChar] = reactExports.useState(null);
  const [croppingImage, setCroppingImage] = reactExports.useState(null);
  const [editingCharName, setEditingCharName] = reactExports.useState(null);
  const [renamingChar, setRenamingChar] = reactExports.useState(null);
  const [renameValue, setRenameValue] = reactExports.useState("");
  const renameInputRef = reactExports.useRef(null);
  const [showScrollTop, setShowScrollTop] = reactExports.useState(false);
  const isManagementModalOpen = showAddModal || !!showDeleteModal || showHiddenCharacters;
  const canDragReorder = sortMethod === "common" && !searchQuery.trim();
  const [characterContextMenu, setCharacterContextMenu] = reactExports.useState(null);
  const [fixRunning, setFixRunning] = reactExports.useState(false);
  const [updatingCharacters, setUpdatingCharacters] = reactExports.useState(false);
  const [scanningOrganization, setScanningOrganization] = reactExports.useState(false);
  const [nevernessDx12Status, setNevernessDx12Status] = reactExports.useState(() => initialCache?.nevernessDx12Status || (activeGame?.id === "neverness-to-everness" ? { success: true, mode: readNevernessModeFallback(activeGame), paths: {} } : null));
  const [showDx12RiskConfirm, setShowDx12RiskConfirm] = reactExports.useState(false);
  const [dx12Busy, setDx12Busy] = reactExports.useState(false);
  const [pinnedCharacters, setPinnedCharacters] = reactExports.useState(() => readCharacterPinnedSet(activeGame?.id));
  const [pinnedCharactersStorageKey, setPinnedCharactersStorageKey] = reactExports.useState(() => getCharacterPinnedStorageKey(activeGame?.id));
  const [showAllCharactersStorageKey, setShowAllCharactersStorageKey] = reactExports.useState(() => getCharacterShowAllStorageKey(activeGame?.id));
  const [showAllCharacters, setShowAllCharacters] = reactExports.useState(() => readCharacterShowAll(activeGame?.id));
  const characterNames = reactExports.useMemo(() => characters.map((char) => char.name), [characters]);
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const isNeverness = activeGame?.id === "neverness-to-everness";
  const isWuwa = activeGame?.id === "wuthering-waves";
  const nevernessMode = nevernessDx12Status?.mode === "dx12" ? "dx12" : "nemi";
  const characterUsageMap = reactExports.useMemo(() => {
    try {
      const raw = localStorage.getItem(getCharacterUsageStorageKey(activeGame?.id));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [activeGame?.id, characters]);
  const [pinyinLoaded, setPinyinLoaded] = reactExports.useState(!!_pinyin);
  reactExports.useEffect(() => {
    if (!_pinyin) pinyinReady.then(() => setPinyinLoaded(true));
  }, []);
  const batchImportHasIntegratedCandidate = !!(batchImport?.items?.some((item) => item.integratedPackageCandidate) || batchImport?.classifyItems?.some((item) => item.integratedPackageCandidate));
  const batchImportHasCertainIntegratedCandidate = !!(batchImport?.items?.some((item) => item.integratedPackageCandidate && !item.integratedPackageAmbiguous) || batchImport?.classifyItems?.some((item) => item.installAsIntegratedPackage));
  const batchImportHasManagedInstall = !!(batchImport?.items?.some((item) => isManagedInstallContentType(item.installContentType)) || batchImport?.classifyItems?.some((item) => isManagedInstallContentType(item.installContentType)));
  const batchImportTitle = batchImportHasManagedInstall ? "安装更新包 / 修复器" : batchImport?.entryMode === "integratedPackage" || batchImportHasCertainIntegratedCandidate ? "整合包导入" : "批量导入 Mod";
  const batchImportIsIntegratedEntry = batchImport?.entryMode === "integratedPackage" || batchImportHasIntegratedCandidate;
  const searchableCharacterIndex = reactExports.useMemo(() => {
    return new Map(
      characters.map((char) => {
        const name = typeof char?.name === "string" ? char.name : "";
        const baseTerms = [name, ...Array.isArray(char?.searchTerms) ? char.searchTerms : []];
        let fullPinyin = "";
        let initialPinyin = "";
        try {
          if (name && _pinyin) {
            fullPinyin = _pinyin(name, { toneType: "none" }) || "";
            initialPinyin = _pinyin(name, { toneType: "none", pattern: "first" }) || "";
          }
        } catch {
        }
        const normalizedTerms = Array.from(
          new Set(
            [
              ...baseTerms,
              fullPinyin,
              initialPinyin,
              String(fullPinyin).replace(/\s+/g, ""),
              String(initialPinyin).replace(/\s+/g, "")
            ].map(normalizeSearchValue).filter(Boolean)
          )
        );
        return [char.name, normalizedTerms];
      })
    );
  }, [characters, pinyinLoaded]);
  const visibleCharacters = reactExports.useMemo(() => {
    const modeFiltered = showAllCharacters ? characters : characters.filter((char) => Number(char?.modCount || 0) > 0);
    const filtered = normalizedSearchQuery ? modeFiltered.filter((char) => {
      const tokens = searchableCharacterIndex.get(char?.name) || [];
      return tokens.some((token) => token.includes(normalizedSearchQuery));
    }) : modeFiltered;
    const originalOrderIndex = new Map(characters.map((char, index) => [char.name, index]));
    const sortPinnedFirst = (left, right) => {
      const leftPinned = pinnedCharacters.has(left.name);
      const rightPinned = pinnedCharacters.has(right.name);
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }
      return 0;
    };
    if (sortMethod === "common") {
      return [...filtered].sort((left, right) => {
        const pinnedDiff = sortPinnedFirst(left, right);
        if (pinnedDiff !== 0) return pinnedDiff;
        if (customOrderActive) {
          return (originalOrderIndex.get(left.name) || 0) - (originalOrderIndex.get(right.name) || 0);
        }
        const usageDiff = Number(characterUsageMap?.[right.name] || 0) - Number(characterUsageMap?.[left.name] || 0);
        if (usageDiff !== 0) return usageDiff;
        return (originalOrderIndex.get(left.name) || 0) - (originalOrderIndex.get(right.name) || 0);
      });
    }
    if (sortMethod === "name") {
      return [...filtered].sort((left, right) => {
        const pinnedDiff = sortPinnedFirst(left, right);
        if (pinnedDiff !== 0) return pinnedDiff;
        return left.name.localeCompare(right.name, "zh");
      });
    }
    if (sortMethod === "modCount") {
      return [...filtered].sort((left, right) => {
        const pinnedDiff = sortPinnedFirst(left, right);
        if (pinnedDiff !== 0) return pinnedDiff;
        if ((right?.modCount || 0) !== (left?.modCount || 0)) {
          return (right?.modCount || 0) - (left?.modCount || 0);
        }
        return left.name.localeCompare(right.name, "zh");
      });
    }
    return filtered;
  }, [characterUsageMap, characters, customOrderActive, normalizedSearchQuery, pinnedCharacters, searchableCharacterIndex, showAllCharacters, sortMethod]);
  const totalVisibleMods = reactExports.useMemo(
    () => visibleCharacters.reduce((sum, char) => sum + Number(char?.modCount || 0), 0),
    [visibleCharacters]
  );
  const totalVisibleSkins = reactExports.useMemo(
    () => visibleCharacters.reduce((sum, char) => sum + getCharacterSkinCount(char), 0),
    [visibleCharacters]
  );
  const batchCharacterOptions = reactExports.useMemo(() => {
    const originalOrderIndex = new Map(characters.map((char, index) => [char.name, index]));
    return [...characters].sort((left, right) => {
      const leftPinned = pinnedCharacters.has(left.name);
      const rightPinned = pinnedCharacters.has(right.name);
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
      const usageDiff = Number(characterUsageMap?.[right.name] || 0) - Number(characterUsageMap?.[left.name] || 0);
      if (usageDiff !== 0) return usageDiff;
      return (originalOrderIndex.get(left.name) || 0) - (originalOrderIndex.get(right.name) || 0);
    });
  }, [characterUsageMap, characters, pinnedCharacters]);
  function getBatchCharacterOptions(query) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return batchCharacterOptions.slice(0, 24);
    return batchCharacterOptions.filter((char) => {
      const tokens = searchableCharacterIndex.get(char?.name) || [];
      return tokens.some((token) => token.includes(normalizedQuery));
    }).slice(0, 24);
  }
  function updateBatchClassifyItem(index, patch) {
    setBatchImport((prev) => prev?.classifyItems ? {
      ...prev,
      classifyItems: prev.classifyItems.map((it, i) => i === index ? { ...it, ...patch } : it)
    } : prev);
  }
  function updateBatchCharacterPickerPosition(input) {
    const rect = input?.getBoundingClientRect?.();
    if (!rect) return;
    const margin = 12;
    const width = Math.max(rect.width, 220);
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openAbove ? spaceAbove - 6 : spaceBelow - 6));
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    const top = openAbove ? Math.max(margin, rect.top - maxHeight - 6) : Math.min(window.innerHeight - margin - maxHeight, rect.bottom + 6);
    setBatchCharacterPickerPosition({ top, left, width, maxHeight });
  }
  function selectBatchCharacter(index, characterName) {
    updateBatchClassifyItem(index, {
      targetCharacter: characterName,
      charQuery: characterName === "其他" ? "" : characterName,
      charPickerOpen: false
    });
    setBatchCharacterPickerPosition(null);
  }
  function updateBatchScanItem(index, patch) {
    setBatchImport((prev) => prev?.items ? {
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, ...patch } : item)
    } : prev);
  }
  function setBatchPlanPreviewItemSelected(index, previewItem, checked) {
    setBatchImport((prev) => prev?.items ? {
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index || !isBatchFolderPlanItem(item)) return itemIndex === index ? { ...item, selected: checked } : item;
        const targetPath = previewItem?.path;
        const plan = item.importPlan;
        const nextPlan = {
          ...plan,
          wholeItem: plan.wholeItem?.path === targetPath ? { ...plan.wholeItem, selected: checked } : plan.wholeItem,
          splitOptions: (plan.splitOptions || []).map((option) => ({
            ...option,
            items: (option.items || []).map((entry) => entry.path === targetPath ? { ...entry, selected: checked } : entry)
          })),
          integratedOptions: (plan.integratedOptions || []).map((option) => ({
            ...option,
            item: option.item?.path === targetPath ? { ...option.item, selected: checked } : option.item
          }))
        };
        return { ...item, importPlan: nextPlan, selected: true };
      })
    } : prev);
  }
  function setBatchPlanScanMode(index, item, mode) {
    if (!isBatchFolderPlanItem(item)) return;
    const plan = item.importPlan;
    const patch = { selectedImportMode: mode };
    if (mode === "multiple" && !item.selectedSplitOptionId) {
      patch.selectedSplitOptionId = plan.defaultSplitOptionId || plan.splitOptions?.[0]?.id || "";
    }
    if (mode === "integrated" && !item.selectedIntegratedOptionId) {
      patch.selectedIntegratedOptionId = plan.defaultIntegratedOptionId || plan.integratedOptions?.[0]?.id || "";
    }
    updateBatchScanItem(index, patch);
  }
  function setClassifyInstallMode(index, item, mode) {
    const singleName = item.singleModName || stripDisabledPrefix(item.realName || item.name || item.modName || "Mod");
    if (mode === "integrated") {
      updateBatchClassifyItem(index, {
        installAsIntegratedPackage: true,
        installAsMultipleMods: false,
        modName: "整合包",
        charPickerOpen: false
      });
    } else if (mode === "multiple") {
      updateBatchClassifyItem(index, {
        installAsIntegratedPackage: false,
        installAsMultipleMods: true,
        singleModName: singleName,
        modName: `${item.multiModCount || item.multiModNames?.length || 2} Mods`,
        charPickerOpen: false
      });
    } else {
      const targetCharacter = item.targetCharacter && item.targetCharacter !== "__all__" ? item.targetCharacter : autoMatchCharacter(singleName, characters);
      updateBatchClassifyItem(index, {
        installAsIntegratedPackage: false,
        installAsMultipleMods: false,
        modName: singleName,
        singleModName: singleName,
        targetCharacter,
        charQuery: targetCharacter === "其他" ? "" : targetCharacter,
        charPickerOpen: false
      });
    }
    setBatchCharacterPickerPosition(null);
  }
  reactExports.useEffect(() => {
    fetchCharacters({ keepVisible: !!initialCache || initialized });
    setShowHiddenCharacters(false);
    setHiddenCharacterCount(0);
  }, [activeGame?.id]);
  reactExports.useEffect(() => {
    if (initialCache?.needsRefresh) {
      fetchCharacters({ keepVisible: true });
    }
  }, [initialCache?.needsRefresh, activeGame?.id]);
  reactExports.useEffect(() => {
    if (activeGame?.id !== "neverness-to-everness") {
      setNevernessDx12Status(null);
      setShowDx12RiskConfirm(false);
      return;
    }
    setNevernessDx12Status((prev) => prev || { success: true, mode: readNevernessModeFallback(activeGame), paths: {} });
    refreshNevernessDx12Status();
  }, [activeGame?.id, activeGame?.launchMode]);
  reactExports.useEffect(() => {
    if (activeGame?.id !== "neverness-to-everness") return;
    const handleNevernessModeChanged = async () => {
      await refreshNevernessDx12Status();
    };
    window.addEventListener("qaqm-neverness-mode-changed", handleNevernessModeChanged);
    return () => window.removeEventListener("qaqm-neverness-mode-changed", handleNevernessModeChanged);
  }, [activeGame?.id]);
  reactExports.useEffect(() => {
    let refreshTimer = null;
    const cleanup = window.api.onModsChanged?.((data = {}) => {
      if (refreshTimer) clearTimeout(refreshTimer);
      const delay = data?.fullRefresh || data?.reason === "preset-applied" ? 120 : 40;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        fetchCharacters({ keepVisible: true });
      }, delay);
    });
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (cleanup) cleanup();
    };
  }, [activeGame?.id]);
  reactExports.useEffect(() => {
    if (!pendingBatchItems?.length || !initialized) return;
    const items = pendingBatchItems.map((item) => ({ ...item, selected: true }));
    setBatchImport({
      phase: "scan",
      folderPath: null,
      items,
      entryMode: "droppedFiles",
      preferredCharacter: pendingBatchPreferredCharacter || ""
    });
    onPendingBatchConsumed?.();
  }, [pendingBatchItems, pendingBatchPreferredCharacter, initialized]);
  reactExports.useEffect(() => {
    const nextSortMethod = (() => {
      try {
        return localStorage.getItem(`charview-sort-${activeGame?.id || "default"}`) || "common";
      } catch {
        return "common";
      }
    })();
    setSortMethod(nextSortMethod);
    setSearchQuery("");
    setShowAllCharactersStorageKey(getCharacterShowAllStorageKey(activeGame?.id));
    setShowAllCharacters(readCharacterShowAll(activeGame?.id));
  }, [activeGame?.id]);
  reactExports.useEffect(() => {
    const storageKey = getCharacterShowAllStorageKey(activeGame?.id);
    if (showAllCharactersStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, showAllCharacters ? "true" : "false");
    } catch {
    }
  }, [activeGame?.id, showAllCharacters, showAllCharactersStorageKey]);
  reactExports.useEffect(() => {
    setPinnedCharacters(readCharacterPinnedSet(activeGame?.id));
    setPinnedCharactersStorageKey(getCharacterPinnedStorageKey(activeGame?.id));
  }, [activeGame?.id]);
  reactExports.useEffect(() => {
    const storageKey = getCharacterPinnedStorageKey(activeGame?.id);
    if (pinnedCharactersStorageKey !== storageKey) return;
    writeCharacterPinnedSet(activeGame?.id, pinnedCharacters);
  }, [activeGame?.id, pinnedCharacters, pinnedCharactersStorageKey]);
  reactExports.useEffect(() => {
    try {
      localStorage.setItem(`charview-sort-${activeGame?.id || "default"}`, sortMethod);
    } catch {
    }
  }, [activeGame?.id, sortMethod]);
  reactExports.useEffect(() => {
    if (!showReorderHint) return void 0;
    const timer = setTimeout(() => setShowReorderHint(false), 2600);
    return () => clearTimeout(timer);
  }, [showReorderHint]);
  reactExports.useEffect(() => {
    if (!characterContextMenu) return void 0;
    const handleClose = () => setCharacterContextMenu(null);
    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest(".character-context-menu")) return;
      setCharacterContextMenu(null);
    };
    const handleKeyDown2 = (event) => {
      if (event.key === "Escape") {
        setCharacterContextMenu(null);
      }
    };
    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown2);
    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown2);
    };
  }, [characterContextMenu]);
  reactExports.useEffect(() => {
    if (characters.length === 0) return;
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return;
    const saved = sessionStorage.getItem("charview-scroll");
    if (saved) {
      requestAnimationFrame(() => {
        mainContent.scrollTop = parseInt(saved, 10);
      });
    }
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        sessionStorage.setItem("charview-scroll", String(mainContent.scrollTop));
        setShowScrollTop(mainContent.scrollTop > 300);
      });
    };
    mainContent.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      mainContent.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [characters]);
  reactExports.useEffect(() => {
    if (showAddModal && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [showAddModal]);
  reactExports.useEffect(() => {
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return void 0;
    const previousOverflow = mainContent.style.overflowY;
    const previousOverscroll = mainContent.style.overscrollBehavior;
    if (isManagementModalOpen) {
      mainContent.style.overflowY = "hidden";
      mainContent.style.overscrollBehavior = "contain";
    }
    return () => {
      mainContent.style.overflowY = previousOverflow;
      mainContent.style.overscrollBehavior = previousOverscroll;
    };
  }, [isManagementModalOpen]);
  reactExports.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function fetchCharacters(options = {}) {
    const { keepVisible = false } = options;
    if (!keepVisible) {
      setLoading(true);
    }
    try {
      const result = await (options.force ? window.api.refreshCharacters() : window.api.getCharacters());
      if (result.success) {
        const nextCharacters = Array.isArray(result.characters) ? result.characters : [];
        const nextCovers = {};
        nextCharacters.forEach((char) => {
          if (char?.name && char?.coverUrl) {
            nextCovers[char.name] = char.coverUrl;
          }
        });
        setMissingPath(false);
        setLoadError("");
        setCharacters(nextCharacters);
        setHiddenCharacterCount(result.hiddenCount || 0);
        setCharacterCovers(nextCovers);
        setLegacyImportPreview(null);
        setLooseRootFolders(null);
        setMisplacedModFolders(null);
        latestPreviewRef.current = null;
        setLegacyPromptDismissed(false);
        onCacheChange?.({
          characters: nextCharacters,
          characterCovers: nextCovers,
          missingPath: false,
          loadError: "",
          legacyImportPreview: null,
          looseRootFolders: null,
          misplacedModFolders: null,
          legacyPromptDismissed: false,
          nevernessDx12Status,
          needsRefresh: false
        });
      } else {
        setCharacters([]);
        setCharacterCovers({});
        setLegacyImportPreview(null);
        setLooseRootFolders(null);
        setMisplacedModFolders(null);
        latestPreviewRef.current = null;
        setLegacyPromptDismissed(false);
        const nextMissingPath = result.code === "MODS_PATH_NOT_SET" || result.code === "MODS_PATH_NOT_FOUND";
        setMissingPath(nextMissingPath);
        setLoadError(result.error || "角色列表加载失败");
        console.error(result.error);
        onCacheChange?.({
          characters: [],
          characterCovers: {},
          missingPath: nextMissingPath,
          loadError: result.error || "角色列表加载失败",
          legacyImportPreview: null,
          looseRootFolders: null,
          misplacedModFolders: null,
          legacyPromptDismissed: false,
          nevernessDx12Status,
          needsRefresh: false
        });
      }
      return !!result.success;
    } catch (err) {
      setCharacters([]);
      setCharacterCovers({});
      setLegacyImportPreview(null);
      setLooseRootFolders(null);
      setMisplacedModFolders(null);
      latestPreviewRef.current = null;
      setLegacyPromptDismissed(false);
      setMissingPath(false);
      setLoadError(err.message || "角色列表加载失败");
      console.error(err);
    } finally {
      setInitialized(true);
      setLoading(false);
    }
  }
  async function handleRefreshCharacters() {
    if (refreshingCharacters || scanningOrganization) return;
    setRefreshingCharacters(true);
    try {
      if (await fetchCharacters({ keepVisible: true, force: true })) {
        setToast({ type: "success", message: "已重新读取本地角色和 Mod" });
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "刷新失败" });
    } finally {
      setRefreshingCharacters(false);
    }
  }
  async function handleUpdateCharacters() {
    if (updatingCharacters || scanningOrganization) return;
    setUpdatingCharacters(true);
    try {
      const result = await window.api.updateCharacterCatalog(activeGame?.id);
      setToast({ type: result?.success ? "success" : "error", message: result?.success ? `角色资料已更新，补充 ${result.added || 0} 个空分类；现有 Mod 分类保持不变` : result?.error || "角色资料更新失败" });
    } catch (error) {
      setToast({ type: "error", message: error.message || "角色资料更新失败" });
    } finally { setUpdatingCharacters(false); }
  }
  async function handleOrganizeCharacters({ quiet = false } = {}) {
    setScanningOrganization(true);
    try {
      const result = await window.api.previewCharacterOrganization();
      if (!result?.success) throw new Error(result?.error || "整理扫描失败");
      const preview = normalizeLegacyPreview(result.legacyImport);
      setLegacyImportPreview(preview);
      latestPreviewRef.current = preview;
      setLegacyPromptDismissed(false);
      setLooseRootFolders(result.looseRootFolders || null);
      setMisplacedModFolders(result.misplacedModFolders || null);
      setShowLooseRootReview(false);
      // Review legacy moves first; rescan after confirmation before reviewing loose files.
      if (preview.hasCandidates) return;
      if (hasDetectedModIssues(result.looseRootFolders, result.misplacedModFolders)) {
        openModIssueReview(result.looseRootFolders, result.misplacedModFolders);
      } else if (!quiet) {
        setToast({ type: "success", message: "扫描完成，没有需要整理的 Mod" });
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "整理扫描失败" });
    } finally {
      setScanningOrganization(false);
    }
  }
  async function handleMigrateLegacyImport() {
    try {
      setMigratingLegacyImport(true);
      const result = await window.api.migrateLegacyImport({ token: legacyImportPreview?.token });
      if (!result?.success) {
        throw new Error(result?.error || "旧结构整理失败");
      }
      const summary = result.summary || {};
      const conflictCount = Array.isArray(summary.skippedConflicts) ? summary.skippedConflicts.length : 0;
      const message = summary.migratedModCount > 0 ? `✨ 已整理 ${summary.migratedModCount} 个 Mod${conflictCount ? `，跳过 ${conflictCount} 个同名目录` : ""}` : conflictCount > 0 ? `检测到 ${conflictCount} 个同名目录，已跳过覆盖` : "当前没有需要整理的旧结构";
      const nextPreview = normalizeLegacyPreview(result.preview);
      latestPreviewRef.current = nextPreview;
      setLegacyImportPreview(nextPreview);
      setLegacyPromptDismissed(false);
      setToast({ type: "success", message });
      await fetchCharacters({ keepVisible: true });
      await handleOrganizeCharacters({ quiet: true });
    } catch (error) {
      setToast({ type: "error", message: error.message || "旧结构整理失败" });
    } finally {
      setMigratingLegacyImport(false);
    }
  }
  function getLooseIssueGroups(scan = looseRootFolders) {
    if (!scan?.hasLooseFolders) return [];
    const groups = [];
    const rootItems = [
      ...scan.rootFolders || scan.folders || [],
      ...scan.rootFiles || []
    ].filter((item) => item?.id);
    if (rootItems.length > 0) {
      groups.push({
        id: "root",
        title: "Mods 根目录",
        subtitle: "这些文件或文件夹没有放进角色分类，可能会被游戏当成错误 Mod 读取。",
        targetText: "其他 / DISABLED_loose-root-时间（禁用脏文件夹）",
        items: rootItems
      });
    }
    for (const group of scan.characterGroups || []) {
      const items = (group.items || []).filter((item) => item?.id);
      if (!items.length) continue;
      groups.push({
        id: `character:${group.characterName}`,
        title: group.characterName,
        subtitle: "这些内容不像独立的中文 Mod 文件夹，可能是某个 Mod 的残片或放错层级的资源。",
        targetText: `${group.characterName} / DISABLED_loose-files-时间（禁用脏文件夹）`,
        items
      });
    }
    return groups;
  }
  function getMisplacedIssueGroups(scan = misplacedModFolders) {
    if (!scan?.hasMisplacedFolders) return [];
    return (scan.groups || []).map((group) => {
      const items = (group.items || []).filter((item) => item?.id);
      if (!items.length) return null;
      return {
        id: `misplaced:${group.targetCharacterName}`,
        title: `移动到 ${group.targetCharacterName}`,
        subtitle: "这些 Mod 文件夹名匹配了其它角色，当前位置可能放错了。",
        targetText: `${group.targetCharacterName} / 原文件夹名`,
        targetCharacterName: group.targetCharacterName,
        items
      };
    }).filter(Boolean);
  }
  function hasDetectedModIssues(looseScan = looseRootFolders, misplacedScan = misplacedModFolders) {
    return getLooseIssueGroups(looseScan).length > 0 || getMisplacedIssueGroups(misplacedScan).length > 0;
  }
  function getLooseIssueDefaultIds(scan = looseRootFolders) {
    return getLooseIssueGroups(scan).flatMap((group) => group.items).filter((item) => item.defaultSelected !== false).map((item) => item.id);
  }
  function getMisplacedIssueDefaultIds(scan = misplacedModFolders) {
    return getMisplacedIssueGroups(scan).flatMap((group) => group.items).filter((item) => item.defaultSelected !== false).map((item) => item.id);
  }
  function getLooseIssueReason(item) {
    if (item.reason === "non-chinese-folder") return "英文/非中文文件夹，默认按脏文件夹处理";
    if (item.reason === "resource-directory") return "Meshes、Textures 等资源目录放在了角色分类根目录";
    if (item.reason === "loose-file") return "Mod 文件没有放进独立 Mod 文件夹";
    if (item.reason === "root-file") return "文件直接放在 Mods 根目录";
    if (item.reason === "root-folder") return "文件夹不属于已知角色分类";
    return item.type === "directory" ? "可能放错位置的文件夹" : "可能放错位置的文件";
  }
  function getMisplacedIssueReason(item) {
    const source = item.sourceLabel || item.sourceCharacterName || "Mods 根目录";
    const target = item.targetCharacterName || "正确角色分类";
    const aliasText = item.matchedAlias ? `，命中“${item.matchedAlias}”` : "";
    if (item.reason === "root-character-mod") return `当前在 ${source}${aliasText}，建议移动到 ${target}`;
    return `当前在 ${source}${aliasText}，建议移动到 ${target}`;
  }
  function openModIssueReview(looseScan = looseRootFolders, misplacedScan = misplacedModFolders) {
    setSelectedLooseRootItemIds(new Set(getLooseIssueDefaultIds(looseScan)));
    setSelectedMisplacedItemIds(new Set(getMisplacedIssueDefaultIds(misplacedScan)));
    setShowLooseRootReview(true);
  }
  function setLooseIssueSelection(ids, selected) {
    setSelectedLooseRootItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }
  function setMisplacedIssueSelection(ids, selected) {
    setSelectedMisplacedItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }
  function toggleLooseIssueItem(id) {
    setSelectedLooseRootItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleMisplacedIssueItem(id) {
    setSelectedMisplacedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function handleQuarantineLooseRootFolders() {
    try {
      const selectedLooseIds = Array.from(selectedLooseRootItemIds);
      const selectedMisplacedIds = Array.from(selectedMisplacedItemIds);
      if (selectedLooseIds.length === 0 && selectedMisplacedIds.length === 0) {
        setToast({ type: "error", message: "请至少勾选一个需要处理的项目" });
        return;
      }
      setQuarantiningLooseRoot(true);
      let movedCount = 0;
      let quarantinedCount = 0;
      if (selectedMisplacedIds.length > 0) {
        const result = await window.api.moveMisplacedModFolders?.({ selectedIds: selectedMisplacedIds });
        if (!result?.success) {
          throw new Error(result?.error || "错放 Mod 移动失败");
        }
        movedCount = result.movedCount || 0;
      }
      if (selectedLooseIds.length > 0) {
        const result = await window.api.quarantineLooseRootFolders?.({ selectedIds: selectedLooseIds });
        if (!result?.success) {
          throw new Error(result?.error || "散落目录整理失败");
        }
        quarantinedCount = result.movedCount || 0;
      }
      setShowLooseRootReview(false);
      setLooseRootFolders(null);
      setMisplacedModFolders(null);
      setToast({
        type: "success",
        message: `已处理完成：移动 ${movedCount} 个错放 Mod，禁用隔离 ${quarantinedCount} 个脏文件`
      });
      await fetchCharacters({ keepVisible: true });
    } catch (error) {
      setToast({ type: "error", message: error.message || "散落目录整理失败" });
    } finally {
      setQuarantiningLooseRoot(false);
    }
  }
  function stripDisabledPrefix(name) {
    return name.replace(/^DISABLED_/i, "");
  }
  function autoMatchCharacter(itemName, charList) {
    const norm = (s) => s.toLowerCase().replace(/[\s_\-·]/g, "");
    const normalized = norm(itemName);
    const getTerms = (c) => {
      const terms = [c.name];
      if (Array.isArray(c.searchTerms)) terms.push(...c.searchTerms);
      return terms;
    };
    for (const c of charList) {
      if (getTerms(c).some((t) => normalized.startsWith(norm(t)))) return c.name;
    }
    for (const c of charList) {
      if (getTerms(c).some((t) => {
        const nt = norm(t);
        return nt && normalized.includes(nt);
      })) return c.name;
    }
    return "其他";
  }
  function handleBatchImportClick() {
    try {
      const dismissed = localStorage.getItem("batch-import-guide-dismissed") === "true";
      if (dismissed) {
        handleOpenBatchImport();
      } else {
        setShowBatchGuide(true);
      }
    } catch {
      setShowBatchGuide(true);
    }
  }
  async function handleOpenBatchImport() {
    setShowBatchGuide(false);
    const result = await window.api.batchScanFolder();
    if (!result || result.canceled || result.error) return;
    const items = (result.items || []).map((item) => ({ ...item, selected: true }));
    setBatchImport({ phase: "scan", folderPath: result.folderPath, items, entryMode: "batch" });
  }
  function handleIntegratedPackageImportClick() {
    setShowIntegratedPackageGuide(true);
  }
  function handleOpenIntegratedPackageDownload() {
    window.api.openExternalUrl?.(INTEGRATED_PACKAGE_DOWNLOAD_URL);
  }
  function handleOpenExtractorDownload() {
    window.api.openExternalUrl?.(INTEGRATED_PACKAGE_EXTRACTOR_URL);
  }
  async function handleOpenIntegratedPackageFiles() {
    setShowIntegratedPackageGuide(false);
    const result = await window.api.batchSelectFiles?.({
      title: "选择整合包文件",
      buttonLabel: "选择整合包",
      filterName: "整合包 / Mod 文件"
    });
    if (!result || result.canceled) return;
    if (result.error) {
      setToast({ type: "error", message: `选择整合包失败：${result.error}` });
      return;
    }
    const items = (result.items || []).map((item) => ({ ...item, selected: true }));
    if (!items.length) {
      setToast({ type: "error", message: "没有找到可安装的整合包文件" });
      return;
    }
    setBatchImport({ phase: "scan", folderPath: null, items, entryMode: "integratedPackage" });
  }
  async function handleStartDecrypt() {
    const selected = expandBatchPlanItems(batchImport.items).filter((i) => i.selected);
    if (!selected.length) return;
    const decryptProgress = selected.map((i) => ({ name: i.name, importDisplayPath: getBatchImportDisplayPath(i), status: "pending", realName: null, error: null }));
    setBatchImport((prev) => ({ ...prev, phase: "decrypting", decryptProgress }));
    const cleanup = window.api.onBatchDecryptProgress?.((data) => {
      setBatchImport((prev) => ({
        ...prev,
        decryptProgress: prev.decryptProgress.map(
          (item, i) => i === data.idx ? {
            ...item,
            status: data.status,
            stage: data.stage || item.stage || "",
            message: data.message || item.message || "",
            realName: data.realName || null,
            error: data.error || null,
            integratedPackageCandidate: !!data.integratedPackageCandidate,
            integratedPackageAmbiguous: !!data.integratedPackageAmbiguous,
            integratedPackageTotalItems: data.integratedPackageTotalItems || 0,
            integratedPackageModCount: data.integratedPackageModCount || 0,
            integratedPackageCharacterCount: data.integratedPackageCharacterCount || 0,
            multiModCandidate: !!data.multiModCandidate,
            multiModCount: data.multiModCount || 0,
            multiModNames: data.multiModNames || []
          } : item
        )
      }));
    });
    const result = await window.api.batchDecryptAll({ items: selected });
    if (cleanup) cleanup();
    const preferredCharacter = batchImport.preferredCharacter && characters.some((char) => char.name === batchImport.preferredCharacter) ? batchImport.preferredCharacter : "";
    const classifyItems = (result.results || []).map((r, i) => {
      const candidateName = stripDisabledPrefix(r.realName || selected[i]?.name || "Mod");
      const installContentType = normalizeInstallContentType(
        r.installContentType || selected[i]?.installContentType
      );
      const managedInstall = isManagedInstallContentType(installContentType);
      const forcedIntegrated = !!(selected[i]?.forceIntegratedPackage || selected[i]?.expectedIntegratedPackage);
      const integratedPackageCandidate = !managedInstall && !!(r.integratedPackageCandidate || forcedIntegrated);
      const installAsIntegratedPackage = !managedInstall && (forcedIntegrated || integratedPackageCandidate && !r.integratedPackageAmbiguous);
      const multiModCandidate = !!r.multiModCandidate;
      const matchedCharacter = managedInstall ? "" : preferredCharacter || autoMatchCharacter(candidateName, characters);
      return {
        filePath: r.originalPath,
        tempPath: r.tempPath,
        path: r.originalPath,
        name: selected[i]?.name || r.realName,
        type: selected[i]?.type,
        importMode: selected[i]?.importMode || "",
        importDisplayPath: getBatchImportDisplayPath(selected[i]),
        realName: r.realName,
        modName: managedInstall ? getInstallContentTypeLabel(installContentType) : installAsIntegratedPackage ? "整合包" : candidateName,
        singleModName: candidateName,
        targetCharacter: matchedCharacter,
        charQuery: matchedCharacter === "其他" ? "" : matchedCharacter,
        selected: r.success,
        decryptSuccess: r.success,
        decryptError: r.error || null,
        installContentType,
        targetGameId: r.targetGameId || selected[i]?.targetGameId || activeGame?.id,
        importerName: r.importerName || selected[i]?.importerName || "",
        managedTargetPath: r.managedTargetPath || selected[i]?.managedTargetPath || "",
        managedTargetLabel: r.managedTargetLabel || selected[i]?.managedTargetLabel || "",
        managedTargetError: r.managedTargetError || selected[i]?.managedTargetError || "",
        integratedPackageCandidate,
        integratedPackageAmbiguous: !!r.integratedPackageAmbiguous,
        installAsIntegratedPackage,
        integratedPackageTotalItems: r.integratedPackageTotalItems || 0,
        integratedPackageModCount: r.integratedPackageModCount || 0,
        integratedPackageCharacterCount: r.integratedPackageCharacterCount || 0,
        multiModCandidate,
        installAsMultipleMods: false,
        multiModCount: r.multiModCount || 0,
        multiModNames: r.multiModNames || []
      };
    });
    setBatchImport((prev) => ({ ...prev, phase: "classify", classifyItems }));
  }
  async function handleStartBatchImport() {
    const { classifyItems } = batchImport;
    const selected = (classifyItems || []).filter((i) => i.selected && i.decryptSuccess);
    if (!selected.length) return;
    const getInstallProgressWeight = (item) => {
      const multiTotal = Number(item.multiModCount || 0);
      if (item.installAsMultipleMods && Number.isFinite(multiTotal) && multiTotal > 1) return multiTotal;
      const integratedTotal = Number(item.integratedPackageTotalItems || item.integratedPackageModCount || 0);
      return item.installAsIntegratedPackage && Number.isFinite(integratedTotal) && integratedTotal > 0 ? integratedTotal : 1;
    };
    const total = selected.reduce((sum, item) => sum + getInstallProgressWeight(item), 0);
    setBatchImport((prev) => ({ ...prev, phase: "importing", progress: 0, total, currentMod: "" }));
    const managedItems = selected.filter((item) => isManagedInstallContentType(item.installContentType));
    const modItems = selected.filter((item) => !isManagedInstallContentType(item.installContentType));
    const cleanup = window.api.onBatchProgress?.((data) => {
      setBatchImport((prev) => ({
        ...prev,
        progress: managedItems.length + data.current,
        total: managedItems.length + data.total,
        currentMod: data.modName
      }));
    });
    const combinedResults = [];
    for (let index = 0; index < managedItems.length; index += 1) {
      const item = managedItems[index];
      setBatchImport((prev) => ({
        ...prev,
        progress: index,
        currentMod: getInstallContentTypeLabel(item.installContentType)
      }));
      const managedResult = await window.api.managedPackageInstall({
        sourcePath: item.filePath || item.path,
        installContentType: item.installContentType,
        gameId: item.targetGameId || activeGame?.id,
        importerName: item.importerName || ""
      });
      combinedResults.push({
        ...managedResult,
        modName: managedResult?.modName || getInstallContentTypeLabel(item.installContentType)
      });
      setBatchImport((prev) => ({ ...prev, progress: index + 1 }));
    }
    let modResult = { results: [] };
    if (modItems.length) modResult = await window.api.batchAddMods({
      items: modItems.map((i) => ({
        filePath: i.filePath || i.path,
        tempPath: i.tempPath || null,
        characterName: i.installAsIntegratedPackage ? "__all__" : i.targetCharacter || "其他",
        modName: i.installAsIntegratedPackage ? "整合包" : i.modName,
        expectedIntegratedPackage: !!i.installAsIntegratedPackage,
        installAsIntegratedPackage: !!i.installAsIntegratedPackage,
        installAsMultipleMods: !!i.installAsMultipleMods,
        integratedPackageTotalItems: i.integratedPackageTotalItems || 0,
        integratedPackageModCount: i.integratedPackageModCount || 0,
        integratedPackageCharacterCount: i.integratedPackageCharacterCount || 0,
        multiModCount: i.multiModCount || 0,
        multiModNames: i.multiModNames || []
      }))
    });
    if (cleanup) cleanup();
    const result = { results: [...combinedResults, ...modResult.results || []] };
    setBatchImport((prev) => ({ ...prev, phase: "done", results: result.results || [] }));
    const importedPak = (result.results || []).some((item) => item.success && item.modMode === "pak");
    const importedIntegrated = (result.results || []).some((item) => item.success && item.integratedPackage);
    const integratedStats = (result.results || []).find((item) => item.success && item.integratedPackage);
    if (importedPak) {
      const status = await refreshNevernessDx12Status();
      if (status?.success) setToast({ type: "success", message: "已识别 Pak Mod 并切换到 Pak 模式" });
    } else if (importedIntegrated) {
      setToast({
        type: "success",
        message: `整合包已覆盖当前 Mods（${integratedStats?.characterCount || 0} 个角色，${integratedStats?.modCount || 0} 个 Mod）`
      });
    } else if (combinedResults.length === 1) {
      setToast({
        type: combinedResults[0].success ? "success" : "error",
        message: getManagedInstallResultMessage(combinedResults[0])
      });
    }
    await fetchCharacters({ keepVisible: true });
  }
  async function handleAddCharacter() {
    if (!newCharName.trim()) {
      setToast({ type: "error", message: "请输入角色名字" });
      return;
    }
    try {
      const result = await window.api.addCharacter(newCharName, null);
      if (result.success) {
        setShowAddModal(false);
        setNewCharName("");
        setTimeout(fetchCharacters, 100);
        setToast({ type: "success", message: "✨ 角色创建成功！" });
      } else {
        setToast({ type: "error", message: "添加失败: " + result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: "添加出错: " + e.message });
    }
  }
  async function handleDeleteCharacter(charName) {
    try {
      const result = await window.api.deleteCharacter(charName);
      if (result.success) {
        setShowDeleteModal(null);
        setToast({ type: "success", message: `🗑️ 角色 "${charName}" 已移入回收站` });
        setTimeout(fetchCharacters, 100);
      } else {
        setToast({ type: "error", message: "删除失败: " + result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: "删除出错: " + e.message });
    }
  }
  async function handleHideCharacter(charName) {
    if (hidingCharacter) return;
    setCharacterContextMenu(null);
    setHidingCharacter(true);
    try {
      const result = await window.api.setCharacterHidden(charName, true, activeGame?.id);
      if (!result?.success) throw Error(result?.error || "隐藏角色失败");
      await fetchCharacters({ keepVisible: true });
      setToast({ type: "success", message: `已隐藏「${charName}」，禁用 ${result.disabledCount} 个 Mod；可在顶部「隐藏角色」中恢复` });
    } catch (error) {
      setToast({ type: "error", message: error.message || "隐藏角色失败" });
    } finally { setHidingCharacter(false); }
  }
  async function handleDropCover(charName, e) {
    const files = e.dataTransfer.files;
    const file = files && files.length > 0 ? files[0] : null;
    if (!isCoverImageFile(file)) {
      setDraggingOver(null);
      return false;
    }
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
    if (files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setCroppingImage(reader.result);
        setEditingCharName(charName);
      };
      reader.readAsDataURL(file);
    }
    return true;
  }
  async function onCropSave(croppedImage) {
    if (!editingCharName || !croppedImage) return;
    try {
      const result = await window.api.setCharacterCover(editingCharName, croppedImage);
      if (result.success) {
        setCharacterCovers((prev) => ({ ...prev, [editingCharName]: result.coverUrl }));
        setToast({ type: "success", message: `✨ ${editingCharName} 封面已更新！` });
      } else {
        setToast({ type: "error", message: "设置封面失败: " + result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: "设置封面出错: " + e.message });
    } finally {
      setCroppingImage(null);
      setEditingCharName(null);
    }
  }
  function handleDragStart(e, charName) {
    if (!canDragReorder) {
      e.preventDefault();
      setShowReorderHint(true);
      return;
    }
    setDraggedChar(charName);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", charName);
    setTimeout(() => {
      e.target.style.opacity = "0.5";
    }, 0);
  }
  function handleDragEnd(e) {
    e.target.style.opacity = "1";
    setDraggedChar(null);
    setDragOverChar(null);
  }
  function handleDragOverReorder(e, charName) {
    e.preventDefault();
    if (draggedChar && draggedChar !== charName) {
      setDragOverChar(charName);
    }
  }
  async function handleDropReorder(e, targetChar) {
    e.preventDefault();
    e.stopPropagation();
    if (!canDragReorder) {
      setDraggedChar(null);
      setDragOverChar(null);
      return;
    }
    if (!draggedChar || draggedChar === targetChar) {
      setDraggedChar(null);
      setDragOverChar(null);
      return;
    }
    if (e.dataTransfer.files.length > 0) {
      handleDropCover(targetChar, e);
      return;
    }
    const newOrder = [...characterNames];
    const draggedIndex = newOrder.indexOf(draggedChar);
    const targetIndex = newOrder.indexOf(targetChar);
    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedChar);
      const characterMap = new Map(characters.map((char) => [char.name, char]));
      setCharacters(newOrder.map((name) => characterMap.get(name)).filter(Boolean));
      try {
        await window.api.saveCharacterOrder(newOrder);
        setCustomOrderActive(true);
        try {
          localStorage.setItem(getCharacterCustomOrderKey(activeGame?.id), "true");
        } catch {
        }
        setToast({ type: "success", message: "✨ 顺序已保存" });
      } catch (err) {
        console.error("Failed to save character order:", err);
      }
    }
    setDraggedChar(null);
    setDragOverChar(null);
  }
  function handleKeyDown(e) {
    if (e.key === "Enter") {
      handleAddCharacter();
    } else if (e.key === "Escape") {
      setShowAddModal(false);
      setNewCharName("");
    }
  }
  async function handleRename(oldName) {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenamingChar(null);
      return;
    }
    try {
      const result = await window.api.renameCharacter(oldName, newName);
      if (result.success) {
        setToast({ type: "success", message: `✨ 已重命名为 "${newName}"` });
        setRenamingChar(null);
        fetchCharacters();
      } else {
        setToast({ type: "error", message: "重命名失败: " + result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: "重命名出错: " + e.message });
    }
  }
  if (loading && !initialized) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "character-view page-transition-enter", style: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", color: "var(--color-text-tertiary)" }, children: "加载中..." });
  }
  function scrollToTop() {
    const mainContent = document.querySelector(".main-content");
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function handlePinCharacter(charName) {
    const wasPinned = pinnedCharacters.has(charName);
    const nextPinnedCharacters = new Set(pinnedCharacters);
    if (wasPinned) {
      nextPinnedCharacters.delete(charName);
    } else {
      nextPinnedCharacters.add(charName);
    }
    writeCharacterPinnedSet(activeGame?.id, nextPinnedCharacters);
    setPinnedCharacters(nextPinnedCharacters);
    setCharacterContextMenu(null);
    setToast({ type: "success", message: wasPinned ? `已取消置顶 ${charName}` : `已置顶 ${charName}` });
  }
  async function handleOpenCharacterFolder(charName) {
    try {
      const result = await window.api.openCharacterFolder(charName);
      if (!result?.success) {
        throw new Error(result?.error || "打开角色目录失败");
      }
      setToast({ type: "success", message: `已打开 ${charName} 的源文件夹` });
    } catch (error) {
      setToast({ type: "error", message: error.message || "打开角色目录失败" });
    } finally {
      setCharacterContextMenu(null);
    }
  }
  async function handleMovePendingModToCharacter(targetCharacterName) {
    const moving = pendingMoveMod;
    setCharacterContextMenu(null);
    if (!moving?.characterName || !moving?.modName) return;
    if (moving.characterName === targetCharacterName) {
      setToast({ type: "error", message: "目标分类与当前分类相同" });
      return;
    }
    try {
      const result = await window.api.moveModToCharacter(moving.characterName, moving.modName, targetCharacterName);
      if (!result?.success) {
        throw new Error(result?.error || "移动失败");
      }
      setToast({ type: "success", message: `已将 ${moving.modName} 移动到 ${targetCharacterName}` });
      onPendingMoveCompleted?.();
      await fetchCharacters({ keepVisible: true });
    } catch (error) {
      setToast({ type: "error", message: error.message || "移动失败" });
    }
  }
  async function handleResetCharacterIni(charName) {
    setCharacterContextMenu(null);
    try {
      const result = await window.api.resetCharacterIni(charName);
      if (!result?.success) {
        throw new Error(result?.error || "重置失败");
      }
      if (result.restoredCount > 0) {
        setToast({ type: "success", message: `${charName} 的 ${result.restoredCount} 个 ini 已重置，请按 F10 重载生效` });
      } else {
        setToast({ type: "success", message: `${charName} 没有需要重置的 ini` });
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "重置失败" });
    }
  }
  async function handleFixAll(mode = "external") {
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixRunAll(mode, activeGame?.id);
      if (result?.canceled) return;
      if (result?.success) {
        setToast({ type: "success", message: "独立修复器已打开" });
      } else {
        setToast({ type: "error", message: result?.error || "打开修复器失败" });
      }
    } catch (e) {
      setToast({ type: "error", message: "打开修复器失败：" + e.message });
    } finally {
      setFixRunning(false);
    }
  }
  async function handleFixCharacter(charName, mode = "external") {
    setCharacterContextMenu(null);
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixRunCharacter(charName, mode, activeGame?.id);
      if (result?.canceled) return;
      if (result?.success) {
        setToast({ type: "success", message: "独立修复器已打开" });
      } else {
        setToast({ type: "error", message: result?.error || "打开修复器失败" });
      }
    } catch (e) {
      setToast({ type: "error", message: "打开修复器失败：" + e.message });
    } finally {
      setFixRunning(false);
    }
  }
  async function handleSelectCustomFixExe() {
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixSelectCustomExe(activeGame?.id);
      if (result?.success) {
        setToast({ type: "success", message: `已保存修复器：${result.fileName}` });
      } else if (!result?.canceled) {
        setToast({ type: "error", message: result?.error || "选择失败" });
      }
    } catch (e) {
      setToast({ type: "error", message: e.message });
    } finally {
      setFixRunning(false);
    }
  }
  async function refreshNevernessDx12Status() {
    try {
      const result = await window.api.nevernessDx12Status?.();
      if (result?.success) {
        setNevernessDx12Status(result);
        try {
          localStorage.setItem("neverness-mod-mode", result.mode === "dx12" ? "dx12" : "nemi");
        } catch {
        }
      }
      return result;
    } catch (e) {
      setToast({ type: "error", message: "读取 Pak 状态失败: " + e.message });
      return null;
    }
  }
  async function handleSwitchNevernessMode(mode) {
    if (!isNeverness || dx12Busy || mode === nevernessMode) return;
    if (mode === "dx12") {
      setShowDx12RiskConfirm(true);
      return;
    }
    setDx12Busy(true);
    try {
      const result = await window.api.nevernessDx12SetMode?.("nemi");
      if (result?.success) {
        setNevernessDx12Status(result);
        try {
          localStorage.setItem("neverness-mod-mode", "nemi");
        } catch {
        }
        setToast({ type: "success", message: "已切回 NEMI / DX11 Mod 模式" });
        fetchCharacters({ keepVisible: true });
      } else {
        setToast({ type: "error", message: result?.error || "切换失败" });
      }
    } catch (e) {
      setToast({ type: "error", message: "切换失败: " + e.message });
    } finally {
      setDx12Busy(false);
    }
  }
  async function confirmEnableDx12Mode() {
    setDx12Busy(true);
    try {
      const status = await refreshNevernessDx12Status();
      if (!status?.success) throw new Error(status?.error || "读取 Pak 状态失败");
      const result = await window.api.nevernessDx12SetMode?.("dx12");
      if (!result?.success) throw new Error(result?.error || "切换失败");
      setNevernessDx12Status(result);
      try {
        localStorage.setItem("neverness-mod-mode", "dx12");
      } catch {
      }
      setShowDx12RiskConfirm(false);
      setToast({ type: "success", message: "已切换到 Pak Mod 模式" });
      fetchCharacters({ keepVisible: true });
    } catch (e) {
      setToast({ type: "error", message: e.message });
    } finally {
      setDx12Busy(false);
    }
  }
  async function handleOpenDx12PakFolder() {
    const result = await window.api.nevernessDx12OpenPakFolder?.();
    if (!result?.success) setToast({ type: "error", message: result?.error || "打开 Pak 文件夹失败" });
  }
  function openCharacterContextMenu(event, charName, pinned) {
    const menuWidth = 220;
    const menuHeight = (isWuwa ? 236 : 190) + 44 + (pendingMoveMod ? 44 : 0);
    const viewportPadding = 12;
    const desiredX = event.clientX + 8;
    const desiredY = event.clientY + 8;
    const nextX = Math.max(viewportPadding, Math.min(desiredX, window.innerWidth - menuWidth - viewportPadding));
    const nextY = Math.max(viewportPadding, Math.min(desiredY, window.innerHeight - menuHeight - viewportPadding));
    setCharacterContextMenu({
      name: charName,
      x: nextX,
      y: nextY,
      pinned
    });
  }
  function renderManagementModal(children, onBackdropClose, contentStyle = void 0) {
    return ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "modal-backdrop",
          onClick: (e) => {
            if (e.target === e.currentTarget) {
              onBackdropClose?.();
            }
          },
          onWheel: (e) => e.preventDefault(),
          children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-content", style: contentStyle, onClick: (e) => e.stopPropagation(), children })
        }
      ),
      document.body
    );
  }
  function renderToolbarActions() {
    const h = reactExports.createElement;
    const busy = refreshingCharacters || updatingCharacters || scanningOrganization || migratingLegacyImport || quarantiningLooseRoot || loading;
    const button = (label, title, onClick, disabled = busy) => h("button", { type: "button", className: "character-tool-button", title, onClick, disabled }, label);
    const group = (label, className, ...children) => h("div", { className: "character-action-group " + className, role: "group", "aria-label": label }, h("span", { className: "character-action-label" }, label), ...children);
    return h("div", { className: "character-toolbar-actions" },
      group("角色资料", "",
        button(updatingCharacters ? "更新中..." : "更新角色", "联网更新角色资料，补充缺少的空分类，保留现有目录和 Mod", handleUpdateCharacters),
        button(`隐藏角色${hiddenCharacterCount ? ` (${hiddenCharacterCount})` : ""}`, "管理当前游戏的隐藏角色，恢复显示不会自动启用 Mod", () => setShowHiddenCharacters(true), hidingCharacter)),
      group("本地文件", "",
        button(refreshingCharacters ? "刷新中..." : "刷新", "重新读取本地最新内容，不移动文件", handleRefreshCharacters),
        button(scanningOrganization ? "扫描中..." : "整理", "按规则预览移动计划，确认后才整理文件", () => handleOrganizeCharacters(), busy || missingPath)),
      group("外部工具", "character-external-tools",
        button(fixRunning ? "打开中..." : "🔧 修复器", "打开独立修复器；找不到时选择并保存程序路径", () => handleFixAll("external"), fixRunning))
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-view page-transition-enter", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-toolbar-shell page-transition-enter", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-toolbar-head", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-h2", children: "角色列表" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-toolbar-subtitle", children: [
            "当前显示 ",
            visibleCharacters.length,
            " / ",
            characters.length,
            " 个角色，合计 ",
            totalVisibleMods,
            " 个 Mod · ",
            totalVisibleSkins,
            " 款皮肤"
          ] })
        ] }),
        reactExports.createElement("div", { className: "character-import-actions", role: "group", "aria-label": "导入 Mod" },
          reactExports.createElement("button", { type: "button", className: "btn batch-import-trigger-btn", onClick: handleBatchImportClick, disabled: loading || missingPath }, "批量导入"),
          reactExports.createElement("button", { type: "button", className: "btn btn-secondary elevated-action-btn", onClick: handleIntegratedPackageImportClick, disabled: loading || missingPath }, "整合包导入")
        )
      ] }),
      renderToolbarActions(),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-toolbar-controls", children: [
        isNeverness && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-sort-group", style: { borderColor: nevernessMode === "dx12" ? "rgba(239,68,68,0.28)" : void 0 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "character-sort-label", children: "Mod 模式" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${nevernessMode !== "dx12" ? "active" : ""}`,
              onClick: () => handleSwitchNevernessMode("nemi"),
              disabled: dx12Busy,
              title: "NEMI / 3DMigoto / DX11 模式，使用当前角色目录内的 Mod 文件夹",
              children: "NEMI"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${nevernessMode === "dx12" ? "active" : ""}`,
              onClick: () => handleSwitchNevernessMode("dx12"),
              disabled: dx12Busy,
              title: `Pak 模式，真实文件安装到游戏 Paks\\${nevernessDx12Status?.paths?.pakDirName || "MOD"}\\角色名`,
              children: "Pak"
            }
          ),
          nevernessMode === "dx12" && /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "character-sort-option",
              onClick: handleOpenDx12PakFolder,
              disabled: dx12Busy,
              title: `打开 Client\\WindowsNoEditor\\HT\\Content\\Paks\\${nevernessDx12Status?.paths?.pakDirName || "MOD"}`,
              children: `打开 ${nevernessDx12Status?.paths?.pakDirName || "MOD"}`
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-search-box", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "character-search-icon", children: "🔎" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              placeholder: "搜索角色名 / 英文 / 拼音首字母...",
              className: "character-search-input"
            }
          ),
          searchQuery && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "character-search-clear",
              onClick: () => setSearchQuery(""),
              title: "清空搜索",
              children: "✕"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-sort-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "character-sort-label", children: "显示" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${!showAllCharacters ? "active" : ""}`,
              onClick: () => setShowAllCharacters(false),
              title: "只显示本地已有 Mod 的角色，包括已禁用的 Mod",
              children: "有内容"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${showAllCharacters ? "active" : ""}`,
              onClick: () => setShowAllCharacters(true),
              title: "显示所有默认角色分类，包括暂时没有 Mod 的角色",
              children: "全部角色"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-sort-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "character-sort-label", children: "排序" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${sortMethod === "common" ? "active" : ""}`,
              onClick: () => setSortMethod("common"),
              title: "按你当前保存的常用顺序显示，也支持拖拽调整",
              children: "常用"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${sortMethod === "modCount" ? "active" : ""}`,
              onClick: () => setSortMethod("modCount"),
              title: "按 Mod 数量从多到少排序",
              children: "Mod 数量"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `character-sort-option ${sortMethod === "name" ? "active" : ""}`,
              onClick: () => setSortMethod("name"),
              title: "按角色名称排序",
              children: "名称"
            }
          )
        ] })
      ] }),
      showReorderHint && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "character-toolbar-tip", children: "若要拖拽调整分类卡片顺序，请切回“常用”并清空搜索后再拖拽。" }),
      pendingMoveMod && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-toolbar-tip", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "正在移动 ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: pendingMoveMod.modName }),
          "：请右键目标分类，选择“移动到这里”。"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: onCancelPendingMove, style: { padding: "4px 10px", fontSize: "12px" }, children: "取消移动" })
      ] })
    ] }),
    showDx12RiskConfirm && renderManagementModal(
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { textAlign: "left" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { style: { marginBottom: 14, textAlign: "center", fontSize: 22 }, children: "切换到 Pak Mod？" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "16px 18px", borderRadius: "16px", background: "rgba(239,68,68,0.08)", color: "#991b1b", fontSize: "14px", lineHeight: 1.75, marginBottom: 16 }, children: "任何二游 Mod 都有风险。请确认自己能否承受账号、存档、游戏文件或其它可能损失，再决定是否使用。" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "var(--color-text-secondary)", fontSize: "14px", lineHeight: 1.75, marginBottom: 18 }, children: [
          "管理器会根据当前游戏路径自动推导 ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { style: { wordBreak: "break-all" }, children: `Client\\WindowsNoEditor\\HT\\Content\\Paks\\${nevernessDx12Status?.paths?.pakDirName || "MOD"}\\角色名` }),
          "，只接管 Pak Mod 的安装、删除和启停；Pak Loader 由内置或设置页指定路径启动。"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-actions", style: { display: "flex", justifyContent: "flex-end", gap: 12 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-secondary", onClick: () => setShowDx12RiskConfirm(false), disabled: dx12Busy, children: "取消" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary", onClick: confirmEnableDx12Mode, disabled: dx12Busy, style: { background: "#dc2626", borderColor: "#dc2626" }, children: dx12Busy ? "处理中..." : "确认使用" })
        ] })
      ] }),
      () => !dx12Busy && setShowDx12RiskConfirm(false),
      { width: "min(680px, calc(100vw - 64px))", maxWidth: "min(680px, calc(100vw - 64px))", padding: "34px 42px", textAlign: "left" }
    ),
    missingPath ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-card", style: { textAlign: "center", padding: "40px 32px" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "42px", marginBottom: "12px" }, children: "📁" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-h3", style: { marginBottom: "10px" }, children: [
        activeGame?.name || "当前游戏",
        " 还没有设置 Mods 文件夹"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-body", style: { color: "var(--color-text-secondary)", marginBottom: "20px" }, children: "这个游戏目前是独立配置，角色一览不会再复用其它游戏的目录。请先到系统设置里选择对应游戏的 Mods 文件夹。" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary", onClick: () => onOpenSettings?.(), children: "前往系统设置" })
    ] }) : loadError ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "settings-card", style: { textAlign: "center", padding: "32px", color: "var(--color-danger)" }, children: loadError }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        LegacyImportModal,
        {
          preview: legacyPromptDismissed ? null : legacyImportPreview,
          migrating: migratingLegacyImport,
          onClose: () => setLegacyPromptDismissed(true),
          onMigrate: handleMigrateLegacyImport
        }
      ),
      showLooseRootReview && ReactDOM.createPortal(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", onClick: () => !quarantiningLooseRoot && setShowLooseRootReview(false), children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "modal-content",
            style: { width: "min(760px, calc(100vw - 48px))", maxHeight: "82vh", overflow: "auto", textAlign: "left" },
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", marginBottom: "14px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-h2", style: { color: "#0f766e", marginBottom: "6px" }, children: "确认要整理的 Mod 目录" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "13px", color: "#78350f", lineHeight: 1.7 }, children: "默认勾选建议处理的项目。错放 Mod 会移动到正确角色分类，脏文件会移入禁用脏文件夹；取消勾选的项目会保持原样。" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "btn btn-secondary",
                    onClick: () => setShowLooseRootReview(false),
                    disabled: quarantiningLooseRoot,
                    style: { flexShrink: 0 },
                    children: "关闭"
                  }
                )
              ] }),
              (() => {
                const misplacedGroups = getMisplacedIssueGroups();
                const looseGroups = getLooseIssueGroups();
                const misplacedIds = misplacedGroups.flatMap((group) => group.items.map((item) => item.id));
                const looseIds = looseGroups.flatMap((group) => group.items.map((item) => item.id));
                const allIds = [...misplacedIds, ...looseIds];
                const selectedMisplacedCount = misplacedIds.filter((id) => selectedMisplacedItemIds.has(id)).length;
                const selectedLooseCount = looseIds.filter((id) => selectedLooseRootItemIds.has(id)).length;
                const selectedCount = selectedMisplacedCount + selectedLooseCount;
                const allSelected = allIds.length > 0 && selectedCount === allIds.length;
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", padding: "10px 12px", borderRadius: "8px", background: "#f0fdfa", border: "1px solid #99f6e4", marginBottom: "12px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "13px", color: "#9a3412" }, children: [
                      "已选 ",
                      selectedCount,
                      " / ",
                      allIds.length,
                      " 项",
                      misplacedIds.length > 0 && `；错放 Mod ${selectedMisplacedCount} / ${misplacedIds.length}`,
                      looseIds.length > 0 && `；脏文件 ${selectedLooseCount} / ${looseIds.length}`
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        className: "btn btn-secondary",
                        onClick: () => {
                          setMisplacedIssueSelection(misplacedIds, !allSelected);
                          setLooseIssueSelection(looseIds, !allSelected);
                        },
                        disabled: quarantiningLooseRoot || allIds.length === 0,
                        style: { padding: "7px 12px", fontSize: "12px" },
                        children: allSelected ? "取消全选" : "全选"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "14px" }, children: [
                    misplacedGroups.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 800, color: "#0f766e" }, children: "建议移动到正确角色分类" }),
                      misplacedGroups.map((group) => {
                        const groupIds = group.items.map((item) => item.id);
                        const groupSelectedCount = groupIds.filter((id) => selectedMisplacedItemIds.has(id)).length;
                        const groupAllSelected = groupSelectedCount === groupIds.length;
                        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { border: "1px solid #99f6e4", borderRadius: "10px", overflow: "hidden", background: "#f0fdfa" }, children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: "#ccfbf1", alignItems: "center" }, children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { minWidth: 0 }, children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 800, color: "#134e4a" }, children: group.title }),
                              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#0f766e", marginTop: "3px", lineHeight: 1.5 }, children: [
                                group.subtitle,
                                /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
                                "目标位置：",
                                group.targetText
                              ] })
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "button",
                              {
                                type: "button",
                                className: "btn btn-secondary",
                                onClick: () => setMisplacedIssueSelection(groupIds, !groupAllSelected),
                                disabled: quarantiningLooseRoot,
                                style: { padding: "6px 10px", fontSize: "12px", flexShrink: 0 },
                                children: groupAllSelected ? "取消本组" : "全选本组"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexDirection: "column" }, children: group.items.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                            "label",
                            {
                              style: { display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", gap: "8px", padding: "9px 12px", borderTop: "1px solid #99f6e4", cursor: quarantiningLooseRoot ? "default" : "pointer", alignItems: "start" },
                              children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                  "input",
                                  {
                                    type: "checkbox",
                                    checked: selectedMisplacedItemIds.has(item.id),
                                    onChange: () => toggleMisplacedIssueItem(item.id),
                                    disabled: quarantiningLooseRoot,
                                    style: { marginTop: "3px" }
                                  }
                                ),
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { minWidth: 0 }, children: [
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontWeight: 700, color: "#042f2e", overflowWrap: "anywhere" }, children: item.name }),
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontSize: "12px", color: "#0f766e", lineHeight: 1.5 }, children: getMisplacedIssueReason(item) }),
                                  item.path && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontSize: "11px", color: "#0f766e", overflowWrap: "anywhere", marginTop: "2px" }, children: item.path })
                                ] })
                              ]
                            },
                            item.id
                          )) })
                        ] }, group.id);
                      })
                    ] }),
                    looseGroups.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 800, color: "#92400e" }, children: "建议移入禁用脏文件夹" }),
                      looseGroups.map((group) => {
                        const groupIds = group.items.map((item) => item.id);
                        const groupSelectedCount = groupIds.filter((id) => selectedLooseRootItemIds.has(id)).length;
                        const groupAllSelected = groupSelectedCount === groupIds.length;
                        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { border: "1px solid #fde68a", borderRadius: "10px", overflow: "hidden", background: "#fffbeb" }, children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: "#fef3c7", alignItems: "center" }, children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { minWidth: 0 }, children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 800, color: "#78350f" }, children: group.title }),
                              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#92400e", marginTop: "3px", lineHeight: 1.5 }, children: [
                                group.subtitle,
                                /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
                                "整理路径：",
                                group.targetText
                              ] })
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "button",
                              {
                                type: "button",
                                className: "btn btn-secondary",
                                onClick: () => setLooseIssueSelection(groupIds, !groupAllSelected),
                                disabled: quarantiningLooseRoot,
                                style: { padding: "6px 10px", fontSize: "12px", flexShrink: 0 },
                                children: groupAllSelected ? "取消本组" : "全选本组"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexDirection: "column" }, children: group.items.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                            "label",
                            {
                              style: { display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", gap: "8px", padding: "9px 12px", borderTop: "1px solid #fde68a", cursor: quarantiningLooseRoot ? "default" : "pointer", alignItems: "start" },
                              children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                  "input",
                                  {
                                    type: "checkbox",
                                    checked: selectedLooseRootItemIds.has(item.id),
                                    onChange: () => toggleLooseIssueItem(item.id),
                                    disabled: quarantiningLooseRoot,
                                    style: { marginTop: "3px" }
                                  }
                                ),
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { minWidth: 0 }, children: [
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontWeight: 700, color: "#451a03", overflowWrap: "anywhere" }, children: item.name }),
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontSize: "12px", color: "#92400e", lineHeight: 1.5 }, children: getLooseIssueReason(item) }),
                                  item.path && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontSize: "11px", color: "#a16207", overflowWrap: "anywhere", marginTop: "2px" }, children: item.path })
                                ] })
                              ]
                            },
                            item.id
                          )) })
                        ] }, group.id);
                      })
                    ] })
                  ] })
                ] });
              })(),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "btn btn-secondary",
                    onClick: () => setShowLooseRootReview(false),
                    disabled: quarantiningLooseRoot,
                    children: "取消"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "btn btn-primary",
                    onClick: handleQuarantineLooseRootFolders,
                    disabled: quarantiningLooseRoot || selectedLooseRootItemIds.size + selectedMisplacedItemIds.size === 0,
                    style: { background: "#0f766e", borderColor: "#0f766e" },
                    children: quarantiningLooseRoot ? "整理中..." : selectedMisplacedItemIds.size > 0 && selectedLooseRootItemIds.size > 0 ? "处理已勾选" : selectedMisplacedItemIds.size > 0 ? "移动到正确分类" : "移入脏文件并禁用"
                  }
                )
              ] })
            ]
          }
        ) }),
        document.body
      ),
      showBatchGuide && ReactDOM.createPortal(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-overlay", onClick: () => setShowBatchGuide(false), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-card", onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-hero", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-hero-icon", children: "📦" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "批量导入 Mod" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "快速将多个 Mod 一次性导入到角色目录" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-body", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-num", children: "1" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-title", children: "准备一个文件夹" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step-desc", children: [
                  "把待安装的 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Mod 文件夹" }),
                  "、",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "压缩包" }),
                  "（.zip / .rar / .7z）或 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "exe 自解压压缩包" }),
                  " 放在同一个文件夹里。"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-num", children: "2" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-title", children: "选择该文件夹" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-desc", children: "点击下方按钮后，选择包含这些 Mod 的文件夹即可。" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-num", children: "3" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-title", children: "自动识别角色" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step-desc", children: [
                  "系统会根据文件名 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "自动匹配对应角色分类" }),
                  "，也支持手动调整后再导入。"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "batch-guide-dismiss", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "checkbox",
                    onChange: (e) => {
                      try {
                        localStorage.setItem("batch-import-guide-dismissed", e.target.checked ? "true" : "false");
                      } catch {
                      }
                    }
                  }
                ),
                "下次不再提示"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "10px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setShowBatchGuide(false), children: "取消" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-primary", onClick: handleOpenBatchImport, children: "选择文件夹" })
              ] })
            ] })
          ] })
        ] }) }),
        document.body
      ),
      showIntegratedPackageGuide && ReactDOM.createPortal(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-overlay", onClick: () => setShowIntegratedPackageGuide(false), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-card integrated-package-guide-card", onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-hero", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-hero-icon", children: "🧩" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "整合包导入" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "按文件结构识别整合包，并覆盖到当前 Mods 文件夹" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-body", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-link-row", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary elevated-action-btn", onClick: handleOpenIntegratedPackageDownload, children: "获取整合包" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary elevated-action-btn", onClick: handleOpenExtractorDownload, children: "下载解压软件" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-num", children: "1" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-title", children: "先下载整合包" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step-desc", children: [
                  "整合包会按 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Mods\\角色\\具体mod" }),
                  " 的结构识别，里面可以有多个角色文件夹，也可以只有一个角色文件夹。"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-num", children: "2" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-title", children: "MP4 格式可以直接安装" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step-desc", children: [
                  "如果下载到的是 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "mp4" }),
                  " 文件，直接拖进管理器，或点击下方按钮选择该文件，管理器会先解密再判断是否为整合包。"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-step", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-num", children: "3" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-title", children: "压缩包先解压再导入" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-guide-step-desc", children: "如果是压缩包格式，先用解压软件解出来，再把解压后的文件夹拖进管理器，或选择整合包文件安装。" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-note", children: [
              "普通 Mod 和整合包会按实际文件结构区分；未包含 ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Mods\\角色\\具体mod" }),
              " 的内容不会按整合包覆盖当前 Mods。"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-guide-dismiss", children: "支持 zip / rar / 7z / exe / mp4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-guide-action-buttons", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setShowIntegratedPackageGuide(false), children: "取消" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-primary", onClick: handleOpenIntegratedPackageFiles, children: "选择整合包文件" })
              ] })
            ] })
          ] })
        ] }) }),
        document.body
      ),
      batchImport && ReactDOM.createPortal(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-overlay", onClick: () => !["importing", "decrypting"].includes(batchImport.phase) && setBatchImport(null), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-card", onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-header", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-title", children: batchImportTitle }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "legacy-import-close", onClick: () => setBatchImport(null), disabled: ["importing", "decrypting"].includes(batchImport.phase), children: "✕" })
          ] }),
          batchImport.phase === "scan" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            batchImport.folderPath && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-path", children: batchImport.folderPath }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-hint", children: batchImportHasManagedInstall ? /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: "检测到更新包或修复器，请确认安装方式与目标。" }) : batchImportIsIntegratedEntry ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              "以下 ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: batchImport.items.length }),
              " 个文件将被解密/解压；若识别为整合包，下一步可选择按整合包覆盖当前 Mods，或按单个 Mod 安装到角色。"
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              "以下 ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: batchImport.items.length }),
              " 个文件将被解密，解密完成后显示真实 Mod 名称，再选择目标分类。"
            ] }) }),
            batchImport.items.some((item) => isBatchFolderPlanItem(item)) && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-plan-list", children: batchImport.items.map((item, idx) => {
              if (!isBatchFolderPlanItem(item)) return null;
              const plan = item.importPlan;
              const selectedMode = getPlanSelectedMode(item);
              const selectedSplitOption = (plan.splitOptions || []).find((option) => option.id === item.selectedSplitOptionId) || (plan.splitOptions || []).find((option) => option.id === plan.defaultSplitOptionId) || (plan.splitOptions || [])[0];
              const selectedIntegratedOption = (plan.integratedOptions || []).find((option) => option.id === item.selectedIntegratedOptionId) || (plan.integratedOptions || []).find((option) => option.id === plan.defaultIntegratedOptionId) || (plan.integratedOptions || [])[0];
              return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-card", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-head", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-plan-name", children: plan.rootName || item.name }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-desc", children: [
                      "自动判断：",
                      getBatchPlanModeLabel(plan.defaultMode),
                      "。如果识别错了，可以在这里改。"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-mode", role: "group", "aria-label": "导入方式", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        className: selectedMode === "single" ? "active" : "",
                        onClick: () => setBatchPlanScanMode(idx, item, "single"),
                        children: "单个 Mod"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        className: selectedMode === "multiple" ? "active" : "",
                        disabled: !plan.splitOptions?.length,
                        onClick: () => setBatchPlanScanMode(idx, item, "multiple"),
                        children: "多个 Mod"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        className: selectedMode === "integrated" ? "active" : "",
                        disabled: !plan.integratedOptions?.length,
                        onClick: () => setBatchPlanScanMode(idx, item, "integrated"),
                        children: "整合包"
                      }
                    )
                  ] })
                ] }),
                selectedMode === "multiple" && selectedSplitOption && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-row", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "导入层级" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "select",
                    {
                      value: selectedSplitOption.id,
                      onChange: (e) => updateBatchScanItem(idx, { selectedSplitOptionId: e.target.value }),
                      children: (plan.splitOptions || []).map((option) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: option.id, children: [
                        option.label,
                        "（",
                        option.itemCount,
                        " 项）",
                        option.pathLabel ? ` · ${option.pathLabel}` : ""
                      ] }, option.id))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: selectedSplitOption.description })
                ] }),
                selectedMode === "integrated" && selectedIntegratedOption && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-row", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "整合包层级" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "select",
                    {
                      value: selectedIntegratedOption.id,
                      onChange: (e) => updateBatchScanItem(idx, { selectedIntegratedOptionId: e.target.value }),
                      children: (plan.integratedOptions || []).map((option) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: option.id, children: [
                        option.label,
                        option.pathLabel ? ` · ${option.pathLabel}` : ""
                      ] }, option.id))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: selectedIntegratedOption.description })
                ] })
              ] }, item.path || idx);
            }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-list-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 20 } }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 44 }, children: "类型" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: "当前将导入的内容" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 148, textAlign: "right", fontSize: "11px", color: "var(--color-text-tertiary)" }, children: "安装方式" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-list", children: batchImport.items.flatMap((sourceItem, sourceIdx) => getSelectedBatchPlanItems(sourceItem).map((item, previewIdx) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-item", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "checkbox",
                  checked: item.selected !== false,
                  onChange: (e) => setBatchPlanPreviewItemSelected(sourceIdx, item, e.target.checked)
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-type", children: item.type }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "batch-import-item-main", title: getBatchImportDisplayPath(item), children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-primary", children: item.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-path", children: getBatchImportDisplayPath(item) }),
                (item.managedTargetLabel || item.managedTargetError) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-path", title: item.managedTargetPath || item.managedTargetError, children: item.managedTargetError || `目标：${item.managedTargetLabel}` })
              ] }),
              item.suggestedContentType ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                "select",
                {
                  value: normalizeInstallContentType(item.installContentType),
                  onChange: (event) => updateBatchScanItem(sourceIdx, {
                    installContentType: event.target.value,
                    targetGameId: event.target.value === "game-package-update" && item.suggestedContentType === "game-package-update" ? item.targetGameId || activeGame?.id : activeGame?.id,
                    importerName: event.target.value === "game-package-update" && item.suggestedContentType === "game-package-update" ? item.importerName || "" : "",
                    managedTargetPath: "",
                    managedTargetLabel: "",
                    managedTargetError: ""
                  }),
                  style: { width: 148, flexShrink: 0, fontSize: "12px" },
                  "aria-label": `${item.name} 安装方式`,
                  children: MANAGED_INSTALL_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: option.value, children: option.label }, option.value))
                }
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 148, textAlign: "right", fontSize: "11px", color: item.forceIntegratedPackage || item.integratedPackageCandidate ? "#059669" : item.disguised ? "#e67e22" : "var(--color-text-tertiary)" }, children: item.forceIntegratedPackage || item.integratedPackageCandidate ? "整合包" : item.disguised ? "加密 Mod" : item.importMode === "single" ? "单个 Mod" : "Mod" })
            ] }, `${sourceIdx}-${previewIdx}-${item.path || item.name}`))) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-summary", children: (() => {
              const previewItems = expandBatchPlanItems(batchImport.items);
              return `共 ${previewItems.length} 项，已选 ${previewItems.filter((i) => i.selected).length} 项`;
            })() }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setBatchImport(null), children: "取消" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  className: "btn btn-primary",
                  onClick: handleStartDecrypt,
                  disabled: !expandBatchPlanItems(batchImport.items).some((i) => i.selected),
                  children: [
                    "开始分析 (",
                    expandBatchPlanItems(batchImport.items).filter((i) => i.selected).length,
                    ")"
                  ]
                }
              )
            ] })
          ] }),
          batchImport.phase === "decrypting" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-hint", children: [
              "解密中... ",
              (batchImport.decryptProgress || []).filter((i) => ["done", "error", "skipped"].includes(i.status)).length,
              " / ",
              (batchImport.decryptProgress || []).length
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-list", children: (batchImport.decryptProgress || []).map((item, idx) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-item", style: { gap: "8px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { width: 16, flexShrink: 0, textAlign: "center" }, children: [
                item.status === "pending" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#aaa" }, children: "⋯" }),
                item.status === "running" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#e67e22", display: "inline-block", animation: "spin 1s linear infinite" }, children: "⟳" }),
                item.status === "done" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#27ae60" }, children: "✓" }),
                item.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#e74c3c" }, children: "✗" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "batch-import-item-main", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-primary", children: item.name }),
                item.importDisplayPath && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-path", children: item.importDisplayPath })
              ] }),
              item.status === "running" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#e67e22", fontSize: "12px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.message || "正在处理..." }),
              item.status === "done" && item.realName && item.realName !== item.name && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#27ae60", fontSize: "12px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                "→ ",
                item.realName
              ] }),
              item.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#e74c3c", fontSize: "11px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.error })
            ] }, idx)) })
          ] }),
          batchImport.phase === "classify" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-hint", children: (() => {
              const integratedCount = (batchImport.classifyItems || []).filter((item) => item.integratedPackageCandidate).length;
              return integratedCount > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                "解密完成！已识别 ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: integratedCount }),
                " 个整合包候选，可逐项选择按整合包覆盖当前 Mods，或按单个 Mod 安装到角色。"
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                "确认 Mod 名称，可选择已有分组或直接输入新分组。",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-hint-matched", children: "绿色" }),
                "为已指定分组，",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-hint-unmatched", children: "橙色" }),
                "将归入「其他」。"
              ] });
            })() }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-list-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 20 } }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: "Mod 名称" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 238 }, children: "安装位置" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-list batch-import-classify-list", children: (batchImport.classifyItems || []).map((item, idx) => {
              const installAsIntegratedPackage = !!item.installAsIntegratedPackage;
              const installAsMultipleMods = !installAsIntegratedPackage && !!item.installAsMultipleMods;
              const isMultiModCandidate = !!item.multiModCandidate;
              const isMatched = isManagedInstallContentType(item.installContentType) || installAsIntegratedPackage || item.targetCharacter && item.targetCharacter !== "其他";
              const characterOptions = getBatchCharacterOptions(item.charQuery ?? "");
              return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `batch-import-item ${item.decryptSuccess ? installAsIntegratedPackage ? "integrated" : isMatched ? "matched" : "unmatched" : "fail"}`, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: item.selected,
                    disabled: !item.decryptSuccess,
                    onChange: (e) => setBatchImport((prev) => ({
                      ...prev,
                      classifyItems: prev.classifyItems.map((it, i) => i === idx ? { ...it, selected: e.target.checked } : it)
                    }))
                  }
                ),
                item.decryptSuccess ? isManagedInstallContentType(item.installContentType) ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-classify-main", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-item-name", style: { display: "flex", alignItems: "center" }, children: getInstallContentTypeLabel(item.installContentType) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-classify-path", title: item.filePath || item.path, children: item.realName || item.name })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-install-mode", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-current-target", title: item.managedTargetPath || item.managedTargetError, children: item.managedTargetError || item.managedTargetLabel || "目标将在安装时从当前配置重新校验" }) })
                ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-classify-main", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "input",
                      {
                        className: "batch-import-item-name",
                        value: item.modName,
                        readOnly: installAsIntegratedPackage || installAsMultipleMods,
                        onChange: (e) => setBatchImport((prev) => ({
                          ...prev,
                          classifyItems: prev.classifyItems.map((it, i) => i === idx ? { ...it, modName: e.target.value, singleModName: it.installAsIntegratedPackage ? it.singleModName : e.target.value } : it)
                        }))
                      }
                    ),
                    item.importDisplayPath && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-classify-path", title: item.importDisplayPath, children: item.importDisplayPath })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-install-mode", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-mode-toggle three", role: "group", "aria-label": "安装方式", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: !installAsIntegratedPackage && !installAsMultipleMods ? "active" : "",
                          onClick: () => setClassifyInstallMode(idx, item, "single"),
                          children: "单个"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: installAsMultipleMods ? "active" : "",
                          title: isMultiModCandidate ? "按多个 Mod 安装" : "尝试按多个 Mod 安装",
                          onClick: () => setClassifyInstallMode(idx, item, "multiple"),
                          children: "多个"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: installAsIntegratedPackage ? "active" : "",
                          onClick: () => setClassifyInstallMode(idx, item, "integrated"),
                          children: "整合包"
                        }
                      )
                    ] }),
                    installAsIntegratedPackage ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-integrated-target", children: "覆盖当前 Mods" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-character-picker", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          className: `batch-import-char-search-inline ${isMatched ? "matched" : "unmatched"}`,
                          value: item.charQuery ?? (item.targetCharacter === "其他" ? "" : item.targetCharacter || ""),
                          placeholder: "搜索角色或输入新分组",
                          "aria-label": "导入目标分组",
                          onFocus: (e) => {
                            updateBatchCharacterPickerPosition(e.currentTarget);
                            updateBatchClassifyItem(idx, { charPickerOpen: true });
                          },
                          onBlur: () => setTimeout(() => {
                            updateBatchClassifyItem(idx, { charPickerOpen: false });
                            setBatchCharacterPickerPosition(null);
                          }, 120),
                          onChange: (e) => {
                            updateBatchCharacterPickerPosition(e.currentTarget);
                            updateBatchClassifyItem(idx, { charQuery: e.target.value, targetCharacter: e.target.value.trim() || "其他", charPickerOpen: true });
                          },
                          onKeyDown: (e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                              e.preventDefault();
                              selectBatchCharacter(idx, e.currentTarget.value.trim() || "其他");
                            }
                            if (e.key === "Escape") {
                              updateBatchClassifyItem(idx, { charPickerOpen: false });
                              setBatchCharacterPickerPosition(null);
                            }
                          }
                        }
                      ),
                      item.charPickerOpen && batchCharacterPickerPosition && ReactDOM.createPortal(
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "div",
                          {
                            className: "batch-import-character-options batch-import-character-options-portal",
                            style: {
                              top: batchCharacterPickerPosition.top,
                              left: batchCharacterPickerPosition.left,
                              width: batchCharacterPickerPosition.width,
                              maxHeight: batchCharacterPickerPosition.maxHeight
                            },
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "batch-import-character-option other", onMouseDown: (e) => {
                                e.preventDefault();
                                selectBatchCharacter(idx, "其他");
                              }, children: "其他 / 暂不匹配" }),
                              item.charQuery?.trim() && !characters.some((character) => character.name === item.charQuery.trim()) && jsxRuntimeExports.jsx("button", {
                                type: "button", className: "batch-import-character-option",
                                onMouseDown: (e) => { e.preventDefault(); selectBatchCharacter(idx, item.charQuery.trim()); },
                                children: `使用新分组「${item.charQuery.trim()}」`
                              }),
                              characterOptions.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                "button",
                                {
                                  type: "button",
                                  className: `batch-import-character-option ${item.targetCharacter === c.name ? "active" : ""}`,
                                  onMouseDown: (e) => {
                                    e.preventDefault();
                                    selectBatchCharacter(idx, c.name);
                                  },
                                  children: [
                                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: c.name }),
                                    pinnedCharacters.has(c.name) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-character-badge", children: "置顶" }),
                                    !pinnedCharacters.has(c.name) && Number(characterUsageMap?.[c.name] || 0) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-character-badge", children: "常用" })
                                  ]
                                },
                                c.name
                              )),
                              characterOptions.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-character-empty", children: "没有匹配角色" })
                            ]
                          }
                        ),
                        document.body
                      )
                    ] })
                  ] })
                ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1, color: "var(--color-error, #e74c3c)", fontSize: "12px" }, children: [
                  item.name,
                  " — 解密失败: ",
                  item.decryptError
                ] })
              ] }, idx);
            }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-summary", children: (() => {
              const all = batchImport.classifyItems || [];
              const ok = all.filter((i) => i.decryptSuccess);
              const sel = ok.filter((i) => i.selected);
              const managed = sel.filter((i) => isManagedInstallContentType(i.installContentType));
              const integrated = sel.filter((i) => i.installAsIntegratedPackage);
              const matched = sel.filter((i) => !isManagedInstallContentType(i.installContentType) && !i.installAsIntegratedPackage && i.targetCharacter !== "其他");
              return `共 ${all.length} 项，分析成功 ${ok.length} 项，已选 ${sel.length} 项，其中 ${managed.length} 项组件/修复器、${integrated.length} 项整合包、${matched.length} 项已指定分组`;
            })() }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setBatchImport(null), children: "取消" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  className: "btn btn-primary",
                  onClick: handleStartBatchImport,
                  disabled: !(batchImport.classifyItems || []).some((i) => i.selected && i.decryptSuccess),
                  children: [
                    "开始安装 (",
                    (batchImport.classifyItems || []).filter((i) => i.selected && i.decryptSuccess).length,
                    ")"
                  ]
                }
              )
            ] })
          ] }),
          batchImport.phase === "importing" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-progress-wrap", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-progress-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "导入中..." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                batchImport.progress ?? 0,
                " / ",
                batchImport.total ?? 0
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-progress-bar-bg", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "batch-import-progress-bar-fill",
                style: { width: `${batchImport.total ? Math.round(batchImport.progress / batchImport.total * 100) : 0}%` }
              }
            ) }),
            batchImport.currentMod && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-progress-current", children: batchImport.currentMod })
          ] }),
          batchImport.phase === "done" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-done-summary", children: [
              batchImport.results.filter((r) => r.success).length,
              " 个成功，",
              batchImport.results.filter((r) => !r.success).length,
              " 个失败"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-results", children: batchImport.results.map((r, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `batch-import-result-item ${r.success ? "success" : "fail"}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-result-icon", children: r.success ? "✓" : "✗" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-result-name", children: r.modName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-result-char", children: r.integratedPackage ? `覆盖当前 Mods：${r.characterCount || 0} 角色 / ${r.modCount || 0} Mod` : r.characterName }),
              !r.success && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-error", children: r.error })
            ] }, i)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-actions", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-primary", onClick: () => setBatchImport(null), children: "完成" }) })
          ] })
        ] }) }),
        document.body
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-grid", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "character-card add-card form-pop-enter",
            onClick: () => setShowAddModal(true),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setShowAddModal(true);
              }
            },
            role: "button",
            tabIndex: 0,
            "aria-label": "新增角色分类",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "48px", marginBottom: "8px" }, children: "+" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: "600" }, children: "新增角色" })
            ]
          }
        ),
        visibleCharacters.map((char) => {
          const charName = char.name;
          const isPinned = pinnedCharacters.has(charName);
          const skinCount = getCharacterSkinCount(char);
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: `character-card form-pop-enter ${draggingOver === charName ? "dragging" : ""} ${dragOverChar === charName ? "drag-target" : ""} ${draggedChar === charName ? "dragging-self" : ""}`,
              draggable: canDragReorder,
              style: { cursor: canDragReorder ? "grab" : "pointer" },
              onClick: () => onSelectCharacter(charName),
              onKeyDown: (event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelectCharacter(charName);
                }
              },
              role: "group",
              "aria-roledescription": "可打开的角色卡片",
              tabIndex: 0,
              "aria-label": `${charName}，${char.enabledCount || 0} 个 Mod 已启用，共 ${char.modCount || 0} 个 Mod，${skinCount} 款皮肤，按回车打开`,
              onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                openCharacterContextMenu(e, charName, isPinned);
              },
              onDragStart: (e) => handleDragStart(e, charName),
              onDragEnd: handleDragEnd,
              onDragOver: (e) => {
                if (draggedChar && canDragReorder) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDragOverReorder(e, charName);
                } else if (dataTransferIncludesCoverImage(e.dataTransfer)) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggingOver !== charName) {
                    setDraggingOver(charName);
                  }
                } else if (draggingOver === charName) {
                  setDraggingOver(null);
                }
              },
              onDragLeave: (e) => {
                if (draggingOver === charName) {
                  e.preventDefault();
                }
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDraggingOver(null);
                  setDragOverChar(null);
                }
              },
              onDrop: (e) => {
                if (draggedChar) {
                  handleDropReorder(e, charName);
                } else if (dataTransferIncludesCoverImage(e.dataTransfer)) {
                  handleDropCover(charName, e);
                } else {
                  setDraggingOver(null);
                }
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "delete-btn",
                    onClick: (e) => {
                      e.stopPropagation();
                      setShowDeleteModal(charName);
                    },
                    title: "删除角色",
                    children: "✕"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card-image", children: [
                  characterCovers[charName] ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "img",
                    {
                      src: characterCovers[charName],
                      alt: charName,
                      draggable: false,
                      loading: "lazy",
                      decoding: "async",
                      referrerPolicy: "no-referrer",
                      onError: () => setCharacterCovers(previous => ({ ...previous, [charName]: null }))
                    }
                  ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "40px", color: "#95a5a6" }, children: charName.charAt(0).toUpperCase() }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card-stats-badge", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "icon", children: "📦" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "count", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: char.enabledCount > 0 ? "var(--color-accent-primary)" : "inherit" }, children: char.enabledCount || 0 }),
                      "/",
                      char.modCount || 0
                    ] })
                  ] }),
                  skinCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-skin-count-badge", "aria-label": `${skinCount} 款官方皮肤`, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: "👗" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: skinCount }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "款皮肤" })
                  ] }),
                  isPinned && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "character-pin-badge", children: "📌" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card-bottom-section", style: { width: "100%", boxSizing: "border-box", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card-name", style: { display: "flex", alignItems: "center", gap: "4px", justifyContent: "center", width: "100%" }, children: renamingChar === charName ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    ref: renameInputRef,
                    type: "text",
                    value: renameValue,
                    onChange: (e) => setRenameValue(e.target.value),
                    onKeyDown: (e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleRename(charName);
                      if (e.key === "Escape") setRenamingChar(null);
                    },
                    onBlur: () => handleRename(charName),
                    onClick: (e) => e.stopPropagation(),
                    style: {
                      width: "100%",
                      padding: "4px 8px",
                      fontSize: "14px",
                      border: "2px solid var(--color-accent-primary)",
                      borderRadius: "6px",
                      textAlign: "center",
                      fontWeight: 600,
                      background: "white",
                      outline: "none"
                    },
                    autoFocus: true
                  }
                ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }, title: charName, children: charName }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "rename-btn",
                      style: { flexShrink: 0 },
                      onClick: (e) => {
                        e.stopPropagation();
                        setRenamingChar(charName);
                        setRenameValue(charName);
                        setTimeout(() => renameInputRef.current?.select(), 50);
                      },
                      title: "重命名",
                      children: "✏️"
                    }
                  )
                ] }) }) }),
                draggingOver === charName && !draggedChar && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drop-overlay", children: "释放设置封面" }),
                dragOverChar === charName && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drop-overlay reorder-overlay", children: "📍 放置到此处" })
              ]
            },
            charName
          );
        }),
        visibleCharacters.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "character-empty-state form-pop-enter", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "character-empty-icon", children: "🔍" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "character-empty-title", children: "没有找到匹配角色" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "character-empty-text", children: "试试更短的关键词，或者切换回“常用 / 名称 / Mod 数量”查看。" })
        ] })
      ] })
    ] }),
    toast && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `toast toast-${toast.type}`, children: toast.message }),
    croppingImage && /* @__PURE__ */ jsxRuntimeExports.jsx(
      ImageCropper,
      {
        imageSrc: croppingImage,
        onCancel: () => {
          setCroppingImage(null);
          setEditingCharName(null);
        },
        onSave: onCropSave
      }
    ),
    showHiddenCharacters && reactExports.createElement(HiddenCharactersDialog, {
      key: activeGame?.id, gameId: activeGame?.id, gameName: activeGame?.name,
      onClose: () => setShowHiddenCharacters(false),
      onRestored: (name) => { fetchCharacters({ keepVisible: true }); setToast({ type: "success", message: `已恢复显示「${name}」，Mod 保持禁用` }); }
    }),
    showAddModal && renderManagementModal(
      /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-h2", style: { marginBottom: "20px", color: "var(--color-accent-primary)" }, children: "✨ 新增角色" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            ref: inputRef,
            type: "text",
            placeholder: "输入角色名字...",
            value: newCharName,
            onChange: (e) => setNewCharName(e.target.value),
            onKeyDown: handleKeyDown,
            className: "input",
            style: { width: "100%", marginBottom: "24px", boxSizing: "border-box" }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "16px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: handleAddCharacter,
              className: "btn btn-primary",
              style: { flex: 1 },
              children: "确认创建"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => {
                setShowAddModal(false);
                setNewCharName("");
              },
              className: "btn btn-secondary",
              style: { flex: 1 },
              children: "取消"
            }
          )
        ] })
      ] }),
      () => {
        setShowAddModal(false);
        setNewCharName("");
      }
    ),
    showDeleteModal && renderManagementModal(
      /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-h2", style: { marginBottom: "16px", color: "var(--color-danger)" }, children: "⚠️ 确认删除" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-body", style: { marginBottom: "32px" }, children: [
          "确定要把角色 ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
            '"',
            showDeleteModal,
            '"'
          ] }),
          " 移入回收站吗？",
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "var(--color-danger)" }, children: "该角色下的所有 Mod 会一起移入系统回收站。" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "16px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => handleDeleteCharacter(showDeleteModal),
              className: "btn btn-danger",
              style: { flex: 1 },
              children: "移入回收站"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => setShowDeleteModal(null),
              className: "btn btn-secondary",
              style: { flex: 1 },
              children: "取消"
            }
          )
        ] })
      ] }),
      () => setShowDeleteModal(null)
    ),
    characterContextMenu && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop character-context-backdrop", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "modal-content character-context-menu",
          style: { left: `${characterContextMenu.x}px`, top: `${characterContextMenu.y}px` },
          onClick: (e) => e.stopPropagation(),
          onContextMenu: (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "character-context-item", onClick: () => handlePinCharacter(characterContextMenu.name), children: characterContextMenu.pinned ? "📍 取消置顶" : "📌 置顶到最上方" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "character-context-item", onClick: () => handleOpenCharacterFolder(characterContextMenu.name), children: "📂 打开源文件夹" }),
            reactExports.createElement("button", { className: "character-context-item", disabled: hidingCharacter, title: "保留角色文件，禁用该角色的全部 Mod，并从列表中隐藏", onClick: () => handleHideCharacter(characterContextMenu.name) }, "隐藏角色（禁用全部 Mod）"),
            pendingMoveMod && characterContextMenu.name !== pendingMoveMod.characterName && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "character-context-item",
                onClick: () => handleMovePendingModToCharacter(characterContextMenu.name),
                style: { color: "#2563eb", fontWeight: 700 },
                children: "📦 移动到这里"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "character-context-item",
                onClick: () => handleFixCharacter(characterContextMenu.name, "external"),
                disabled: fixRunning,
                style: { color: "#f97316" },
                children: "🔧 修复器"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "character-context-item",
                onClick: () => handleResetCharacterIni(characterContextMenu.name),
                style: { color: "#0f766e" },
                children: "🔄 重置该分类全部 Mod ini"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "character-context-item",
                onClick: () => {
                  setCharacterContextMenu(null);
                  handleSelectCustomFixExe();
                },
                disabled: fixRunning,
                style: { color: "#6b7280", fontSize: "12px" },
                children: "📁 更换修复器"
              }
            )
          ]
        }
      ) }),
      document.body
    ),
    showScrollTop && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: scrollToTop,
          style: {
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--color-accent-gradient, linear-gradient(135deg, #ff9a9e, #fecfef))",
            color: "white",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(255,143,163,0.4)",
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            transition: "transform 0.2s, opacity 0.2s",
            animation: "fadeIn 0.2s ease-out"
          },
          title: "回到顶部",
          children: "↑"
        }
      ),
      document.body
    )
  ] });
}
export {
  CharacterView as default
};
