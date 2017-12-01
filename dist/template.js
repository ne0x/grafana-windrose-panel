"use strict";

System.register([], function (_export, _context) {
  "use strict";

  var template;
  return {
    setters: [],
    execute: function () {
      template = "\n<div class=\"graph-wrapper\">\n  <div class=\"graph-canvas-wrapper\">\n    <div ng-if=\"datapointsWarning\" class=\"datapoints-warning\">\n      <span class=\"small\" ng-show=\"!datapointsCount\">\n        No datapoints <tip>No datapoints returned from metric query</tip>\n      </span>\n      <span class=\"small\" ng-show=\"datapointsOutside\">\n        Datapoints outside time range\n        <tip>Can be caused by timezone mismatch between browser and graphite server</tip>\n      </span>\n    </div>\n    <div grafana-wind-rose style=\"z-index: 0;\" ng-dblclick=\"ctrl.zoomOut()\">\n    </div>\n  </div>\n</div>\n<div class=\"clearfix\"></div>\n";

      _export("default", template);
    }
  };
});
//# sourceMappingURL=template.js.map
