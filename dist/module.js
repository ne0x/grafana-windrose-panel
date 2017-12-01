'use strict';

System.register(['lodash', './wind_rose_ctrl', './wind_rose', './series_overrides_ctrl'], function (_export, _context) {
  "use strict";

  var _, WindRoseCtrl;

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_wind_rose_ctrl) {
      WindRoseCtrl = _wind_rose_ctrl.WindRoseCtrl;
    }, function (_wind_rose) {}, function (_series_overrides_ctrl) {}],
    execute: function () {
      _export('PanelCtrl', WindRoseCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
