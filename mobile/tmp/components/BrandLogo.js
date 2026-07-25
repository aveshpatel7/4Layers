"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = BrandLogo;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _reactNative = require("react-native");

function BrandLogo(_ref) {
  var _ref$size = _ref.size;
  var size = _ref$size === undefined ? "medium" : _ref$size;
  var _ref$color = _ref.color;
  var color = _ref$color === undefined ? "#22C55E" : _ref$color;
  var _ref$bg = _ref.bg;
  var bg = _ref$bg === undefined ? "#0E0E0E" : _ref$bg;

  var isLarge = size === "large";
  var iconSize = isLarge ? 36 : 24;
  var fontSize = isLarge ? 28 : 20;
  var borderWidth = isLarge ? 3.5 : 2.5;
  var gapWidth = iconSize * 0.35;
  var gapHeight = iconSize * 0.25;

  return _react2["default"].createElement(
    _reactNative.View,
    { style: styles.container },
    _react2["default"].createElement(
      _reactNative.View,
      { style: { width: iconSize, height: iconSize, justifyContent: "center", alignItems: "center" } },
      _react2["default"].createElement(_reactNative.View, {
        style: {
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          borderWidth: borderWidth,
          borderColor: color
        }
      }),
      _react2["default"].createElement(_reactNative.View, {
        style: {
          position: "absolute",
          bottom: -1,
          width: gapWidth,
          height: gapHeight,
          backgroundColor: bg
        }
      })
    ),
    _react2["default"].createElement(
      _reactNative.Text,
      { style: [styles.brandText, { fontSize: fontSize, color: color }] },
      "4Layers"
    )
  );
}

var styles = _reactNative.StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  brandText: {
    fontWeight: "900",
    letterSpacing: -0.5,
    fontFamily: _reactNative.Platform.OS === "ios" ? "System" : "sans-serif-medium"
  }
});
module.exports = exports["default"];
/* Image 1 Circular Arc Power Loop Icon */ /* Bottom Gap Mask */ /* Brand Typography (4Layers) */