import template from './template';
import angular from 'angular';
import moment from 'moment';
import _ from 'lodash';
import TimeSeries from 'app/core/time_series2';
import * as fileExport from 'app/core/utils/file_export';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import './colorpicker';
import './css/style.css!';
import './css/colorpicker.css!';

export class WindRoseCtrl extends MetricsPanelCtrl {
  /** @ngInject */
  constructor($scope, $injector, $rootScope, annotationsSrv) {
    super($scope, $injector, annotationsSrv);
    this.$rootScope = $rootScope;

    var panelDefaults = {
      // datasource name, null = default datasource
      datasource: null,
      // windrose options
      windRoseOptions: {
        windRoseType: '1',
        axisFrequency: '15',
        axisName: 'Windspeed, m/s',
        scale: 'linear',
        maxV: '',
        dotColors: [{val: '#000000'}],
        lastPointColor: '#000000',
        gradientBasedOn: 'age',
        alphaBlending: true,
        alphaBlendingMinOpacity: 0,
        labelDegrees: true,
        labelCardinalCompass: false,
        labelIntercardinalCompass: false,
        labelCompassRose: false,
        labelCompassRoseOpacity: 0.4,
        labelCompassRoseSize: 0.8,
        numOfDirections: '4',
        windSpeedStep: 0.5,
        chartColors: [{val: '#0000ff'}],
        showPercents: true,
        percentsPosition: 45,
        chartOpacity: 1,
        peakTypeBar: false,
        peakTypeLine: true,
        peakTypePoints: false,
        peakTypeLineFill: '0',
        peakTypeLineWidth: '1',
        peakTypePointsRadius: '4'
      },
      seriesOverrides: [],
      // time overrides
      timeFrom: null,
      timeShift: null,
      // metric queries
      targets: [{}]
    };

    _.defaultsDeep(this.panel, angular.copy(panelDefaults));

    this.hiddenSeries = {};
    this.seriesList = [];
    this.colors = $scope.$root.colors;

    this.customGradientFields = [];

    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataSnapshotLoad.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
  }

  onInitEditMode() {
    this.addEditorTab('Axes', 'public/plugins/n-wind-rose-panel/tab_axes.html', 3);
    this.addEditorTab('Options', 'public/plugins/n-wind-rose-panel/tab_options.html', 4);

    this.subTabIndex = 0;
  }

  onInitPanelActions(actions) {
    actions.push({text: 'Export CSV (series as rows)', click: 'ctrl.exportCsv()'});
    actions.push({text: 'Export CSV (series as columns)', click: 'ctrl.exportCsvColumns()'});
  }

  setUnitFormat(axis, subItem) {
    axis.format = subItem.value;
    this.render();
  }

  issueQueries(datasource) {
    if (!this.panel.targets || this.panel.targets.length === 0) {
      return this.$q.when([]);
    }

    this.panel.targets = _.map(this.panel.targets, function (target) {
      target.delta = true; // notify delta support
      return target;
    });

    return super.issueQueries(datasource);
  }

  zoomOut(evt) {
    this.publishAppEvent('zoom-out', evt);
  }

  onDataSnapshotLoad(snapshotData) {
    this.onDataReceived(snapshotData.data);
  }

  onDataError(err) {
    this.seriesList = [];
    this.render([]);
  }

  onDataReceived(dataList) {
    this.datapointsWarning = false;
    this.datapointsCount = 0;
    this.datapointsOutside = false;
    var maxTimeSeries = 56;
    if (dataList.length > maxTimeSeries) {
      var msg = 'wind rose panel warning: exceed max time series (support' + maxTimeSeries + ' time series)';
      this.$rootScope.appEvent('alert-warning', [msg, '']);
      dataList = dataList.slice(0, maxTimeSeries); // TODO: support only 5 time series
    }
    this.seriesList = dataList.map(this.seriesHandler.bind(this));
    this.customGradientFields = [];
    var self = this;
    this.seriesList = _.each(this.seriesList, function (item) {
        var alias = item['alias'].match(/\[(.*)\]/);
        if (alias && alias[1] && alias[1] != 'direction') {
            self.customGradientFields.push(item['alias'].split('[')[0]);
        }
    });
    this.datapointsWarning = this.datapointsCount === 0 || this.datapointsOutside;

    this.loading = false;
    this.render(this.seriesList);
  }

  seriesHandler(seriesData, index) {
    var datapoints = seriesData.datapoints;
    var alias = seriesData.target;
    var colorIndex = index % this.colors.length;
    var color = this.colors[colorIndex];

    var series = new TimeSeries({
      datapoints: datapoints,
      alias: alias,
      color: color,
      unit: seriesData.delta || false // TODO: fix, use unit as delta temporaly
    });

    if (datapoints && datapoints.length > 0) {
      var last = moment.utc(datapoints[datapoints.length - 1][1]);
      var from = moment.utc(this.range.from);
      if (last - from < -10000) {
        this.datapointsOutside = true;
      }

      this.datapointsCount += datapoints.length;
    }

    return series;
  }

  onRender() {
    if (!this.seriesList) { return; }
    var self = this;
    this.seriesList = _.filter(this.seriesList, function (item) {
        var alias = item['alias'].match(/\[(.*)\]/);
        return alias && alias[1] && (alias[1] === 'speed_min' || alias[1] === 'speed_max' || alias[1] === 'speed_avg');
    });
    _.each(this.seriesList, function (item) {
        item.applySeriesOverrides(self.panel.seriesOverrides);
    });
  }

  toggleSeries(serie, event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (this.hiddenSeries[serie.alias]) {
        delete this.hiddenSeries[serie.alias];
      } else {
        this.hiddenSeries[serie.alias] = true;
      }
    } else {
      this.toggleSeriesExclusiveMode(serie);
    }
    this.render();
  }

  toggleSeriesExclusiveMode (serie) {
    var hidden = this.hiddenSeries;

    if (hidden[serie.alias]) {
      delete hidden[serie.alias];
    }

    // check if every other series is hidden
    var alreadyExclusive = _.every(this.seriesList, value => {
      if (value.alias === serie.alias) {
        return true;
      }

      return hidden[value.alias];
    });

    if (alreadyExclusive) {
      // remove all hidden series
      _.each(this.seriesList, value => {
        delete this.hiddenSeries[value.alias];
      });
    } else {
      // hide all but this serie
      _.each(this.seriesList, value => {
        if (value.alias === serie.alias) {
          return;
        }

        this.hiddenSeries[value.alias] = true;
      });
    }
  }

  addSeriesOverride(override) {
    this.panel.seriesOverrides.push(override || {});
  }

  removeSeriesOverride(override) {
    this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
    this.render();
  }

  exportCsv() {
    fileExport.exportSeriesListToCsv(this.seriesList);
  }

  exportCsvColumns() {
    fileExport.exportSeriesListToCsvColumns(this.seriesList);
  }
}

WindRoseCtrl.template = template;
