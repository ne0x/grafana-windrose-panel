var template = `
<div class="graph-wrapper">
  <div class="graph-canvas-wrapper">
    <div ng-if="datapointsWarning" class="datapoints-warning">
      <span class="small" ng-show="!datapointsCount">
        No datapoints <tip>No datapoints returned from metric query</tip>
      </span>
      <span class="small" ng-show="datapointsOutside">
        Datapoints outside time range
        <tip>Can be caused by timezone mismatch between browser and graphite server</tip>
      </span>
    </div>
    <div grafana-wind-rose style="z-index: 0;" ng-dblclick="ctrl.zoomOut()">
    </div>
  </div>
</div>
<div class="clearfix"></div>
`;

export default template;
