import angular from 'angular';
import $ from 'jquery';
import moment from 'moment';
import _ from 'lodash';
import d3 from './bower_components/d3/d3.js';
import './gradient';

angular.module('grafana.directives').directive('grafanaWindRose', function($rootScope, timeSrv, Rainbow) {
  return {
    restrict: 'A',
    template: '<div> </div>',
    link: function(scope, elem) {
      var ctrl = scope.ctrl;
      var panel = ctrl.panel;
      var options = angular.copy(panel.windRoseOptions);
      var strokes = [];
      var ticks = [];
      var randomColors = [];
      var ticksUpdated = null;
      var radius = 300;
      var pointR = 7;
      var containerW = 1000;
      var containerH = 720;
      var bgId = guid();
      var data,
          preparedData,
          dataDirections,
          dataVelocities,
          extraData,
          peaksData,
          svg,
          scale_container,
          points_container,
          chart_container,
          axis_container,
          circles_container,
          compass_rose_container,
          percents_scale_container,
          curve_container,
          points_scale,
          chart_scale,
          colored_scale,
          maxV,
          line_tooltip_container,
          line_tooltip;

      var div = d3.select("body").append('div')
                  .attr('class', 'tooltip')
                  .style('opacity', 0);

      function init () {
          initSvg();
          buildAxis();
          buildScaleContainer();
      }

      function initSvg () {
          svg = d3.select(elem[0]).append('svg')
                  .attr('id', 'chart')
                  .attr('width', containerW)
                  .attr('height', containerH)
                  .attr('viewBox', '0 0 1000 720')
                  .attr('preserveAspectRatio', 'xMidYMid meet')
                  .append('g')
                  .attr('transform', 'translate(480, 360)');

          svg.style('display', 'none');

          circles_container = svg.append('g')
                                 .attr('class', 'circles_container');

          axis_container = svg.append('g')
                              .attr('class', 'axis_container');

          compass_rose_container = svg.append('g')
                                      .attr('class', 'compass_rose_container')
                                      .style('fill', 'none');

          percents_scale_container = svg.append('g')
                                        .attr('class', 'percents_scale_container');

          line_tooltip_container = svg.append('g')
                                          .attr('class', 'line_tooltip_container');

          line_tooltip = line_tooltip_container.append('line')
                                                .attr('class', 'line_tooltip')
                                                .style('stroke', '#f00')
                                                .style('opacity', 0);

          line_tooltip_container.append('circle')
                                .attr('r', radius)
                                .attr('cx', 0)
                                .attr('cy', 0)
                                .attr('opacity', 0)
                                .attr('class', 'show_tooltip');

          curve_container = svg.append('g')
                               .attr('class', 'curve_container');

          points_container = curve_container.append('g')
                                            .attr('class', 'points_container sortable');

          chart_container = svg.append('g')
                               .attr('class', 'chart_container');

          defineBg();
          defineTooltip();

          setTimeout(function () {
              var chart = $(elem).find('#chart'),
                  aspect = chart.width() / chart.height(),
                  container = chart.parent();

              var panelEl = chart.closest('.panel-container');
              scope.panelElW = panelEl.height();

              var cb = function() {
                  var targetWidth = container.width();
                  targetWidth = targetWidth > containerW ? containerW : targetWidth;
                  chart.attr('width', targetWidth);
                  chart.attr('height', Math.round(targetWidth / aspect));
                  svg.style('display', 'block');
              };

              scope.$watch(function () {
                scope.panelElW = panelEl.width();
              });
              scope.$watch('panelElW', cb);
              $(window).on('resize', cb).trigger('resize');
          }, 1000);
      }

      function defineBg () {
          var bgSize = options.labelCompassRoseSize || 0.9;

          var num = (1 - Math.ceil(bgSize * 5) / 5) * 10;
          var delta = num == 0 ? 7 : 7 - (num - Math.log2(num));

          bgSize *= (2 * radius);

          var bgDefEl = svg.selectAll('defs').data([bgSize]);

          bgDefEl.enter().append('defs');
          bgDefEl.exit().remove();

          bgDefEl.append('pattern')
                  .attr('width', function (d) { return d; })
                  .attr('height', function (d) { return d; })
                  .attr('x', function (d) {
                      return -1 * d/2 - delta;
                  })
                  .attr('y', function (d) { return -1 * d/2; })
                  .attr("id", bgId)
                  .attr('patternUnits', 'userSpaceOnUse')
                  .append("image")
                  .attr("xlink:href", "public/plugins/n-wind-rose-panel/img/windrose.svg")
                  .attr('width', function (d) { return d; })
                  .attr('height', function (d) { return d; })
                  .attr('x', 0)
                  .attr('y', 0);

          var imgEl = compass_rose_container.selectAll('circle').data([bgSize]);

          imgEl.enter().append('circle');
          imgEl.exit().remove();

          imgEl.attr('r', function (d) { return d/2; })
               .attr('x', function (d) { return -1 * d/2; })
               .attr('y', function (d) { return -1 * d/2; })
               .attr('class', 'bg_container');
      }

      function defineTooltip () {
          svg.selectAll('.show_tooltip')
            .on('mousemove', function (d) {
              if (peaksData) {
                  line_tooltip.style('opacity', 1);

                  var coords = d3.mouse(this);
                  var hyp = Math.sqrt(coords[0] * coords[0] + coords[1] * coords[1]);
                  var alpha = Math.asin(coords[1]/ hyp) * 180 / Math.PI;
                  if (coords[0] < 0) {
                      alpha = 180 - alpha;
                  }
                  alpha += 90;
                  alpha = Math.round(alpha);
                  var tooltip_points = _.chain(peaksData).map(function (item) {
                      return item['curve'][alpha] && !item['curve'][alpha]['hide'] ? item['curve'][alpha] : null;
                  }).without(null).value();

                  var pointEl = line_tooltip_container.selectAll('.point_tooltip')
                                                      .data(tooltip_points);

                  pointEl.enter().append('circle');
                  pointEl.exit().remove();

                  pointEl.attr('r', function (d) { return +d.point_radius + 3; })
                          .attr('cx', function (d) { return d.x; })
                          .attr('cy', function (d) { return d.y; })
                          .attr('class', 'point_tooltip')
                          .style('fill', '#fff')
                          .style('stroke', '#f00');

                  var x2 = radius * coords[0] / hyp;
                  var y2 = Math.sqrt(radius * radius - x2 * x2);
                  if (coords[1] < 0) {
                      y2 *= -1;
                  }
                  line_tooltip.attr('x1', 0)
                              .attr('x2', x2)
                              .attr('y1', 0)
                              .attr('y2', y2);
                  //tooltip
                  div.style('opacity', 1);

                  var html = '<div class="degree">' + alpha + '\u00B0 </div>';
                  _.each(tooltip_points, function (point) {
                      html += '<div class="info-row"><div class="colored_line" style="background-color:' + point.color + '"></div><span>' + point.alias + '</span><span class="point_v">' + point.v + '</span>';
                      if (point.time) {
                          html += '<span class="point_time">' + point.time + '</span>';
                      }
                      html += '</div>';
                  });
                  div.html(html)
                    .style('left', (d3.event.pageX + 15) + 'px')
                    .style('top', (d3.event.pageY - 38) + 'px');
              }
            })
            .on('mouseout', function () {
                line_tooltip.attr('x1', 0)
                            .attr('x2', 0)
                            .attr('y1', 0)
                            .attr('y2', 0)
                            .style('opacity', 0);

                var pointEl = line_tooltip_container.selectAll('.point_tooltip')
                                                    .data([]);

                pointEl.enter().append('circle');
                pointEl.exit().remove();

                //tooltip
                div.style('opacity', 0)
                    .style('left', 0)
                    .style('top', 0);
            });
      }

      function buildScaleContainer () {
          var lineX = 60;
          var axisName = options.axisName;

          scale_container = svg.append('g')
                               .attr('class', 'scale_container')
                               .attr('transform', 'translate(-460, 0)');

          scale_container.append('text')
                         .attr('x', -50)
                         .attr('y', 0)
                         .text(axisName)
                         .attr('transform', 'rotate(270, 0, 0)')
                         .attr('class', 'axis_title')
                         .style('fill', '#fff');

          points_scale = scale_container.append('g')
                                        .attr('class', 'points_scale');

          chart_scale = scale_container.append('g')
                                       .attr('class', 'chart_scale');

          colored_scale = svg.append('g')
                             .attr('class', 'colored_scale')
                             .attr('transform', 'translate(370, 0)');

          points_scale.append('line')
                      .attr('x1', lineX)
                      .attr('y1', -1 * radius)
                      .attr('x2', lineX)
                      .attr('y2', radius)
                      .style('stroke', '#fff')
                      .style('stroke-width', '5px');
      }

      function setAxisName () {
          var axisName = options.axisName;
          var titleEl = scale_container.selectAll('.axis_title')
                                        .data([axisName]);
          titleEl.enter().append('text');
          titleEl.exit().remove();

          titleEl.attr('x', -50)
                 .attr('y', 0)
                 .text(function (d) { return d; })
                 .attr('transform', 'rotate(270, 0, 0)')
                 .attr('class', 'axis_title')
                 .style('fill', '#fff');
      }

      function buildChartScale (numOfBlocks) {
          var lineX = 20;
          var chartColors = options.chartColors;
          var d = [];
          for (var i = 0; i <= numOfBlocks; i++) {
              var y1 = radius - i * 2 * radius/(numOfBlocks + 1);
              var y2 = y1 - 2 * radius/(numOfBlocks + 1);
              var color = getColorAtPoint(i, 0, numOfBlocks, chartColors);
              d.push({y1: y1, y2: y2, color: color});
          }

          var chartScaleEl = chart_scale.selectAll('.chart_block')
                                        .data(d);

          chartScaleEl.enter().append('line');
          chartScaleEl.exit().remove();

          chartScaleEl.attr('x1', lineX)
                      .attr('y1', function(d) { return d.y1; })
                      .attr('x2', lineX)
                      .attr('y2', function(d) { return d.y2; })
                      .attr('class', 'chart_block')
                      .style('stroke', function (d) { return d.color; })
                      .style('stroke-width', '12px');
      }

      function buildChartScaleLabels (step, numOfBlocks, percents) {
          var x = 35;
          var yOffset = 5;
          var d = [];
          for (var i = 0; i <= numOfBlocks + 1; i++) {
              var y = radius - i * 2 * radius/(numOfBlocks + 1) + yOffset;
              var percent = percents[i] || 0;
              var text = Math.round(i * step * 10) / 10  + '  (' + percent + '%)';
              d.push({y: y, text: text});
          }

          var chartLabelEl = chart_scale.selectAll('.chart_label')
                                        .data(d);

          chartLabelEl.enter().append('text');
          chartLabelEl.exit().remove();

          chartLabelEl.attr('x', x)
                      .attr('y', function(d) { return d.y; })
                      .attr('class', 'chart_label')
                      .text(function (d) { return d.text; })
                      .style('fill', '#fff')
                      .style('font-size', '13px');
      }

      function buildScale () {
          var lineX = 60;
          var scale = options.scale;
          ticksUpdated = null;
          strokes = [];

          var createStrokes = function (ticks) {
              for (var i = 0; i < ticks.length; i++) {
                  var currentYPositive = ticks[i] * radius / ticks[ticks.length - 1];
                  var currentYNegative = -1 * ticks[i] * radius / ticks[ticks.length - 1];
                  strokes.push({x1: lineX - 10, x2: lineX + 10, y1: currentYPositive, y2: currentYPositive});
                  strokes.push({x1: lineX - 10, x2: lineX + 10, y1: currentYNegative, y2: currentYNegative});
              }
          };

          if (scale == 'linear') {
              createStrokes(ticks);
          }
          if (scale == 'square') {
              ticksUpdated = [];
              for (var i = 0; i < ticks.length; i++) {
                  var currentTick = ticks[i] * ticks[i];
                  ticksUpdated.push(currentTick);
              }
              createStrokes(ticksUpdated);
          }
          if (~scale.indexOf('log')) {
              var logBase = scale.match(/\d+/)[0];
              var minV = Math.log(0.1) / Math.log(logBase);
              ticksUpdated = [];
              for (var i = 0; i < ticks.length; i++) {
                  var currentTick = Math.log(ticks[i] + 0.1) / Math.log(logBase);
                  currentTick += Math.abs(minV);
                  ticksUpdated.push(currentTick);
              }
              createStrokes(ticksUpdated);
          }

          var strokesEl = points_scale.selectAll('.stroke')
                                      .data(strokes);

          strokesEl.enter().append('line');
          strokesEl.exit().remove();

          strokesEl.attr('x1', function(d) { return d.x1; })
                   .attr('y1', function(d) { return d.y1; })
                   .attr('x2', function(d) { return d.x2; })
                   .attr('y2', function(d) { return d.y2; })
                   .attr('class', 'stroke')
                   .style('stroke', '#fff')
                   .style('stroke-width', '3px');
      }

      function buildColoredScale () {
          var dotColors = options.dotColors;

          if (dotColors.length < 2 || !preparedData.speeds.speed_main) {
              colored_scale.style('display', 'none');
              return;
          }

          var lineX = 20;
          var d = [];
          var numOfBlocks = 20;
          for (var i = 0; i <= numOfBlocks; i++) {
              var y1 = radius - i * 2 * radius/(numOfBlocks + 1);
              var y2 = y1 - 2 * radius/(numOfBlocks + 1);
              var color = getColorAtPoint(i, 0, numOfBlocks, dotColors);
              d.push({y1: y1, y2: y2, color: color});
          }

          var coloredScaleEl = colored_scale.selectAll('.colored_scale_block')
                                            .data(d);

          coloredScaleEl.enter().append('line');
          coloredScaleEl.exit().remove();

          coloredScaleEl.attr('x1', lineX)
                        .attr('y1', function(d) { return d.y1; })
                        .attr('x2', lineX)
                        .attr('y2', function(d) { return d.y2; })
                        .attr('class', 'colored_scale_block')
                        .style('stroke', function (d) { return d.color; })
                        .style('stroke-width', '12px');
      }

      function buildColoredScaleLabels () {
          var dotColors = options.dotColors;

          if (dotColors.length < 2 || !preparedData.speeds.speed_main) {
              colored_scale.style('display', 'none');
              return;
          }

          var gradientBasedOn = options.gradientBasedOn;
          var colorsObj = getColorsObj();
          var x = 35;
          var yOffset = 5;
          var d = [];
          var numOfBlocks = 20;
          var title = '';

          for (var i = 0; i <= numOfBlocks + 1; i++) {
              var y = radius - i * 2 * radius/(numOfBlocks + 1) + yOffset;
              var text = '';
              if (gradientBasedOn == 'age') {
                  var time = Object.keys(preparedData.direction.datapoints);
                  var minTime = +time[0];
                  var maxTime = +time[time.length - 1];
                  var stepTime = (maxTime - minTime) / (numOfBlocks + 1);
                  text = moment(minTime + i * stepTime).format('YYYY-MM-DD HH:mm');
                  title = 'Age';
              } else {
                  if (!colorsObj) {
                      return;
                  }
                  var colorsArr = _.toArray(colorsObj);
                  var minVal = _.min(colorsArr);
                  var maxVal = _.max(colorsArr);
                  var stepVal = (maxVal - minVal) / (numOfBlocks + 1);
                  text = Math.round((minVal + i * stepVal) * 100) / 100;
                  title = gradientBasedOn;
              }
              d.push({y: y, text: text});
          }

          var coloredScaleLabelEl = colored_scale.selectAll('.colored_scale_label')
                                                  .data(d);

          coloredScaleLabelEl.enter().append('text');
          coloredScaleLabelEl.exit().remove();

          coloredScaleLabelEl.attr('x', x)
                            .attr('y', function(d) { return d.y; })
                            .attr('class', 'colored_scale_label')
                            .text(function (d) { return d.text; })
                            .style('fill', '#fff')
                            .style('font-size', '13px');

          var coloredScaleTitleEl = colored_scale.selectAll('.colored_scale_title')
                                                  .data([title]);

          coloredScaleTitleEl.enter().append('text');
          coloredScaleTitleEl.exit().remove();

          coloredScaleTitleEl.attr('x', -50)
                            .attr('y', 0)
                            .attr('class', 'colored_scale_title')
                            .text(function (d) { return d; })
                            .attr('transform', 'rotate(270, 0, 0)')
                            .style('fill', '#fff');
      }

      function buildR (r) {
          var circleEl = circles_container.selectAll('.circle')
                                          .data(r);

          circleEl.enter().append('circle');
          circleEl.exit().remove();

          circleEl.attr('r', function(d) { return d; })
                  .attr('class', 'circle')
                  .style('fill', '#fff')
                  .style('stroke', '#dcdcdc');
      }

      function buildCircumferences () {
          var r = [];
          var createR = function (ticks) {
              for (var i = ticks.length-1; i >= 0; i--) {
                  var current_r = ticks[i] * radius / ticks[ticks.length - 1];
                  r.push(current_r);
              }
          };

          createR(ticksUpdated || ticks);

          buildR(r);
      }

      function buildChartCircumferences (num) {
          var r = [];
          for (var i = 0; i < num; i++) {
              r.push(radius - i * radius / num);
          }

          buildR(r);
      }

      function buildPercentsScale (num, percents, alpha) {
          if (alpha < 0) {
              var offset = Math.abs(parseInt(alpha/360)) + 1;
              alpha += (360 * offset);
          }
          if (alpha > 360) {
              var offset = parseInt(alpha/360);
              alpha -= (360 * offset);
          }
          var d = [];
          for (var i = 0; i < num; i++) {
              var hypotenuse = radius - i * radius/num - 10;
              var x = Math.sin(alpha * Math.PI / 180) * hypotenuse;
              var y = Math.sqrt(hypotenuse * hypotenuse - x * x);
              if (alpha < 90 || alpha > 270) {
                  y *= -1;
              }
              var textAnchor = 'start';
              if (alpha < 180) {
                  textAnchor = 'end';
              }
              var text = percents[i] + '%';
              d.push({x: x, y: y, text: text, textAnchor: textAnchor});
          }

          var percentsScaleEl = percents_scale_container.selectAll('.percents')
                                                        .data(d);

          percentsScaleEl.enter().append('text');
          percentsScaleEl.exit().remove();

          percentsScaleEl.attr('x', function (d) { return d.x; })
                         .attr('y', function(d) { return d.y; })
                         .text(function (d) { return d.text; })
                         .attr('class', 'percents')
                         .style('fill', '#a0a0a0')
                         .style('text-anchor', function (d) { return d.textAnchor; })
                         .style('font-size', '13px');
      }

      function togglePercents () {
          var showPercents = options.showPercents;
          if (showPercents) {
              percents_scale_container.style('display', 'block');
          } else {
              percents_scale_container.style('display', 'none');
          }
      }

      function buildAxis () {
          var degree = +options.axisFrequency;
          var axis = [];
          var betta = 0;
          var pi = Math.PI;

          var round = function (val) {
              return Math.round(val * 100) / 100;
          };

          while (betta != 180) {
              var x1 = round(Math.cos(betta * pi / 180)) * radius;
              var x2 = round(Math.cos((betta + 180) * pi / 180)) * radius;
              var y1 = round(Math.sin(betta * pi / 180)) * radius;
              var y2 = round(Math.sin((betta + 180) * pi / 180)) * radius;
              var color = betta == 0 || betta == 90 ? '#1f1d1d' : '#dcdcdc';
              axis.push({x1: x1, y1: y1, x2: x2, y2: y2, color: color});
              betta += degree;
          }

          var axisEl = axis_container.selectAll('.line')
                                     .data(axis);

          axisEl.enter().append('line');
          axisEl.exit().remove();

          axisEl.attr('x1', function(d) { return d.x1; })
                .attr('y1', function(d) { return d.y1; })
                .attr('x2', function(d) { return d.x2; })
                .attr('y2', function(d) { return d.y2; })
                .attr('class', 'line')
                .style('stroke', function(d) { return d.color; });
      }

      function buildStrokesLabels () {
          var labels = [];
          var xCoord = 45;
          var yShift = 6;

          var createLabels = function (labelTicks) {
              for (var i = 0; i < labelTicks.length; i++) {
                  var yCoordPositive = labelTicks[i] * radius / labelTicks[labelTicks.length - 1] + yShift;
                  var yCoordNegative = -1 * labelTicks[i] * radius / labelTicks[ticks.length - 1] + yShift;
                  labels.push({text: ticks[i], x: xCoord, y: yCoordPositive});
                  labels.push({text: ticks[i], x: xCoord, y: yCoordNegative});
              }
          };

          createLabels(ticksUpdated || ticks);

          var labelEl = points_scale.selectAll('.axis-label')
                                       .data(labels);

          labelEl.enter().append('text');
          labelEl.exit().remove();

          labelEl.attr('x', function(d) { return d.x; })
                 .attr('y', function(d) { return d.y; })
                 .attr('class', 'axis-label')
                 .text(function(d) { return d.text; })
                 .style('fill', '#fff')
                 .style('font-size', '14px')
                 .style('text-anchor', 'end');
      }

      function buildPoints (points) {
          var circleEl = points_container.selectAll('.circle')
                                         .data(points);

          circleEl.enter().append('circle');
          circleEl.exit().remove();

          circleEl.attr('cx', function(d) { return d.x; })
                  .attr('cy', function(d) { return d.y; })
                  .attr('r', function(d) { return pointR; })
                  .attr('fill', function(d) { return d.color; })
                  .attr('class', 'circle')
                  .on('mouseover', function (d) {
                      div.style('opacity', 1);
                      var html = '<div class="time">' + d.time + '</div> wind_speed: <span class="value">' + d.wind_speed + '</span><br/> wind_dir: <span class="value">' + d.wind_dir + '</span>';
                      if (d.extra) {
                          html += '<br>' + d.extra.title + ': <span class="value">' + d.extra.val + '</span>';
                      }
                      div.html(html)
                          .style('left', (d3.event.pageX + 15) + 'px')
                          .style('top', (d3.event.pageY - 38) + 'px');
                  })
                  .on('mouseout', function () {
                      div.style('opacity', 0)
                         .style('left', 0)
                         .style('top', 0);
                  })
                  .style('opacity', function(d) { return d.opacity; });
      }

      function buildChart (d) {
          var arcEl = chart_container.selectAll('.arc')
                                     .data(d);

          arcEl.enter().append('path');
          arcEl.exit().remove();

          arcEl.attr('d', function (d) { return d.arc(); })
               .attr('class', 'arc')
               .on('mouseover', function (d) {
                    div.style('opacity', 1);

                    var html = '<div class="angle">' + d.startAngle + '\u00B0  -  ' + d.endAngle + '\u00B0</div>';
                    for (var i = 0; i < d.percents.length - 1; i++) {
                        html += '<div class="colored_box" style="background-color: ' + d.percents[i]['color'] + '"></div> <span class="percent">' + d.percents[i]['val'] + '%</span><br/>';
                    }
                    html += '<div class="total"><span>Total:</span><span class="percent">' + d.percents[d.percents.length - 1]['val'] + '%</span></div>';
                    div.html(html)
                       .style('left', (d3.event.pageX + 15) + 'px')
                       .style('top', (d3.event.pageY - 38) + 'px');
                })
                .on('mouseout', function () {
                        div.style('opacity', 0)
                           .style('left', 0)
                           .style('top', 0);
                })
                .style('fill', function (d) { return d.color; });
      }

      function buildExtraLines () {
          if (!peaksData) {
              return;
          }

          var lines_data = [];
          var points_data = [];
          var bars_data = [];

          _.each(peaksData, function (item) {
              if (item.lines) {
                  lines_data.push(item);
              }
              if (item.points) {
                  points_data.push(item);
              }
              if (item.bars) {
                  bars_data.push(item);
              }
          });

          var lineFunc = d3.svg.line()
                               .x(function (d) { return d.x; })
                               .y(function (d) { return d.y; })
                               .interpolate('linear');

          var curveEl = curve_container.selectAll('.peak_line')
                                       .data(lines_data);

          curveEl.enter().append('path');
          curveEl.exit().remove();

          curveEl.attr('d', function (d) { return lineFunc(d.curve); })
                 .attr('stroke', function (d) { return d.curve[0]['color']; })
                 .attr('stroke-width', function (d) { return d.curve[0]['line_width']; })
                 .attr('fill', function (d) { return d.curve[0]['color']; })
                 .attr('fill-opacity', function (d) { return d.curve[0]['fill']; })
                 .attr('class', 'peak_line sortable show_tooltip');

          var curveElPointsContainer = curve_container.selectAll('.peak_points_container')
                                                      .data(points_data);

          curveElPointsContainer.enter().append('g');
          curveElPointsContainer.exit().remove();

          curveElPointsContainer.attr('class', 'peak_points_container sortable');

          var curveElPoints = curveElPointsContainer.selectAll('.peak_points')
                                                    .data(function (d) { return d.curve; });

          curveElPoints.enter().append('circle');
          curveElPoints.exit().remove();

          curveElPoints.attr('cx', function (d) { return d.x; })
                        .attr('cy', function (d) { return d.y; })
                        .attr('r', function (d) { return d.point_radius; })
                        .attr('fill', function (d) { return d.color; })
                        .attr('class', 'peak_points show_tooltip');

          var curveElBarsContainer = curve_container.selectAll('.peak_bars_container')
                                                    .data(bars_data);

          curveElBarsContainer.enter().append('g');
          curveElBarsContainer.exit().remove();

          curveElBarsContainer.attr('class', 'peak_bars_container sortable');

          var curveElBars = curveElBarsContainer.selectAll('.peak_bar')
                                                 .data(function (d) { return d.curve; });

          curveElBars.enter().append('line');
          curveElBars.exit().remove();

          curveElBars.attr('x1', function (d) { return d.x; })
                    .attr('y1', function (d) { return d.y; })
                    .attr('x2', 0)
                    .attr('y2', 0)
                    .attr('stroke', function (d) { return d.color; })
                    .attr('stroke-width', function (d) { return d.line_width; })
                    .attr('class', 'peak_bar show_tooltip');

          svg.selectAll('.sortable').sort(function (a, b) {
              var a_z = a && a.z_index ? a.z_index : 0;
              var b_z = b && b.z_index ? b.z_index : 0;
              return a_z > b_z ? 1 : -1;
          });

          defineTooltip();
      }

      function addCompassRoseAsBackground () {
          var compassRose = options.labelCompassRose;

          setTimeout(function () {
              if (compassRose) {
                  svg.select('.bg_container')
                     .attr('fill', 'url(#' + bgId + ')');
              } else {
                  svg.select('.bg_container')
                     .attr('fill', 'none');
              }
          }, 500);
      }

      function setCompassRoseOpacity () {
          var compassRoseOpacity = options.labelCompassRoseOpacity;
          svg.select('.bg_container').style('opacity', function (d) { return compassRoseOpacity; });
      }

      function styleAxisLabels () {
          var degrees = options.labelDegrees;
          var cardinalCompass = options.labelCardinalCompass;
          var intercardinalCompass = options.labelIntercardinalCompass;
          var compassRose = options.labelCompassRose;

          var alpha = +options.axisFrequency;
          var hardcoded_r = radius + 20;
          var delta = degrees ? 30 : 0;
          var labels = [];

          var getAngleCoords = function (init_alpha, delta) {
              var current_alpha = init_alpha;
              delta = delta || 0;

              if (init_alpha >= 90 && init_alpha < 270) {
                  current_alpha = Math.abs(current_alpha - 180);
              }
              if (init_alpha >= 270 && init_alpha < 360) {
                  current_alpha = Math.abs(current_alpha - 360);
              }

              if (init_alpha > 90 && init_alpha < 270) {
                  hardcoded_r = radius + 30 + delta;
              } else {
                  hardcoded_r = radius + 20 + delta;
              }

              var x = Math.sin(current_alpha * Math.PI / 180) * hardcoded_r;
              if (init_alpha > 180) {
                  x *= -1;
              }

              var y = Math.sqrt(hardcoded_r * hardcoded_r - x* x);
              y *= -1;
              if (init_alpha > 90 && init_alpha < 270) {
                  y *= -1;
              }
              return {x: x, y: y};
          };

          if (degrees) {
              for (var i = 0; i < 360 / alpha; i++) {
                  var init_alpha = i * alpha;
                  var coords = getAngleCoords(init_alpha);
                  labels.push({x: coords.x, y: coords.y, text: init_alpha + '\u00B0'});
              }
          }
          if (cardinalCompass) {
              labels.push({x: 0, y: -1* radius - 10 - delta, text: 'N', fontSize: '18px'});
              labels.push({x: radius + 15 + delta, y: 0, text: 'E', fontSize: '18px'});
              labels.push({x: 0, y: radius + 20 + delta, text: 'S', fontSize: '18px'});
              labels.push({x: -1 * radius - 20 - delta, y: 0, text: 'W', fontSize: '18px'});
          }
          if (cardinalCompass && intercardinalCompass) {
              var compass = [{
                  angle: 45,
                  val: 'NE'
              }, {
                  angle: 135,
                  val: 'SE'
              }, {
                  angle: 225,
                  val: 'SW'
              }, {
                  angle: 315,
                  val: 'NW'
              }];

              _.each(compass, function (item) {
                  var init_alpha = item.angle;
                  var coords = getAngleCoords(init_alpha, delta);
                  labels.push({x: coords.x, y: coords.y, text: item.val, fontSize: '18px'});
              });
          }

          var axisStyleEl = svg.selectAll('.axis-style')
                               .data(labels);

          axisStyleEl.enter().append('text');
          axisStyleEl.exit().remove();

          axisStyleEl.attr('x', function (d) { return d.x; })
                      .attr('y', function (d) { return d.y; })
                      .text(function (d) { return d.text; })
                      .attr('fill', '#fff')
                      .attr('class', 'axis-style')
                      .attr('startOffset', '100%')
                      .style('text-anchor', 'middle')
                      .style('font-size', function (d) { return d.fontSize || '14px'; });
      }

      function setChartOpacity () {
          var chartOpacity = options.chartOpacity;
          chart_container.style('opacity', chartOpacity);
      }

      function toggleWindRoseType (type) {
          var showPercents = options.showPercents;
          switch (type) {
              case 'chart':
                  curve_container.style('display', 'none');
                  points_scale.style('display', 'none');
                  colored_scale.style('display', 'none');
                  chart_container.style('display', 'block');
                  chart_scale.style('display', 'block');
                  if (showPercents) {
                      percents_scale_container.style('display', 'block');
                  }
                  break;
              case 'points':
                  chart_container.style('display', 'none');
                  chart_scale.style('display', 'none');
                  percents_scale_container.style('display', 'none');
                  curve_container.style('display', 'block');
                  points_scale.style('display', 'block');
                  points_container.style('display', 'block');
                  colored_scale.style('display', 'block');
                  break;
          }
      }

      function renderExtraLines (preparedSpeeds) {
          var windRoseType = options.windRoseType;
          var peakTypeBar = options.peakTypeBar;
          var peakTypeLine = options.peakTypeLine;
          var peakTypePoints = options.peakTypePoints;
          var peakTypeLineFill = +options.peakTypeLineFill/10 || 0;
          var peakTypeLineWidth = options.peakTypeLineWidth || 1;
          var peakTypePointsRadius = options.peakTypePointsRadius || 2;

          var overrides = panel.seriesOverrides;

          if (!preparedData || !preparedData.direction) {
              return;
          }

          var res = {};
          var directions = preparedData.direction.datapoints;
          _.each(preparedSpeeds, function (item, key) {
              if (key == 'speed_main') {
                  return;
              }
              var alias = item.alias;
              res[alias] = [];
              _.each(directions, function (point, time) {
                  point = Math.round(point);
                  if (!res[alias][point]) {
                      res[alias][point] = {v: item['datapoints'][time], time: time, key: key};
                      res[alias][point]['length'] = 1;
                      return;
                  }
                  switch (key) {
                      case 'speed_max':
                          if (item['datapoints'][time] > res[alias][point]['v']) {
                              res[alias][point] = {v: item['datapoints'][time], time: time, key: key};
                          }
                          break;
                      case 'speed_min':
                          if (item['datapoints'][time] < res[alias][point]['v']) {
                              res[alias][point] = {v: item['datapoints'][time], time: time, key: key};
                          }
                          break;
                      case 'speed_avg':
                          res[alias][point]['v'] += item['datapoints'][time];
                          res[alias][point]['key'] = key;
                          res[alias][point]['length'] += 1;
                  }
              });
          });
          var j = 0;
          peaksData = _.map(res, function (data, key) {
              var color = randomColors[j];
              j++;
              var key_overrides = _.find(overrides, function (item) { return item.alias == key; });
              var curve = _.map(data, function (point, i) {
                  var curvePointObj = {
                      color: key_overrides && angular.isDefined(key_overrides.color) ? key_overrides.color : color,
                      fill: key_overrides && angular.isDefined(key_overrides.fill) ? key_overrides.fill : peakTypeLineFill,
                      line_width: key_overrides && angular.isDefined(key_overrides.linewidth) ? key_overrides.linewidth : peakTypeLineWidth,
                      point_radius: key_overrides && angular.isDefined(key_overrides.pointradius) ? key_overrides.pointradius : peakTypePointsRadius,
                      z_index: key_overrides && angular.isDefined(key_overrides.zindex) ? key_overrides.zindex : 0,
                      alias: key.split('[')[0]
                  };
                  if (!point) {
                      return _.assignIn(curvePointObj, {
                          x: 0,
                          y: 0,
                          v: 0,
                          time: null,
                          hide: true
                      });
                  }
                  var v = point['v'];
                  var time = +point['time'];
                  var speed_name = point['key'];

                  if (speed_name == 'speed_avg') {
                      v /= point['length'];
                      time = null;
                  }
                  if (v > radius) {
                      v = radius;
                  }
                  var x = Math.sin(i * Math.PI / 180) * v;
                  var y = Math.sqrt(v * v - x * x);
                  if (i < 90 || i > 270) {
                      y *= -1;
                  }
                  return _.assignIn(curvePointObj, {
                      x: x,
                      y: y,
                      v: Math.round(v * maxV / radius * 100)/100 + ' m/s',
                      time: time ? moment(time).format('YYYY-MM-DD HH:mm:ss') : null
                  });
              });

              return { curve: curve,
                      bars: key_overrides && angular.isDefined(key_overrides.bars) ? key_overrides.bars : peakTypeBar,
                      lines: key_overrides && angular.isDefined(key_overrides.lines) ? key_overrides.lines : peakTypeLine,
                      points: key_overrides && angular.isDefined(key_overrides.points) ? key_overrides.points : peakTypePoints,
                      z_index: key_overrides && angular.isDefined(key_overrides.zindex) ? key_overrides.zindex : 0
              };
          });
          buildExtraLines();
      }

      function renderChart () {
          var numOfDirections = options.numOfDirections;
          var windSpeedStep = +options.windSpeedStep || 0.1;
          var percentsPosition = +options.percentsPosition || 45;
          var chartColors = options.chartColors;

          var d = [];
          var percents = [];
          var totalPercents = {0: 0};
          var res = {};

          if (!preparedData || !preparedData.direction || !preparedData.speeds || !preparedData.speeds.speed_main) {
              return;
          }

          var directions = preparedData.direction.datapoints;
          var velocities = preparedData.speeds.speed_main.datapoints;
          var velocitiesArray = _.toArray(velocities);

          var alpha = 360 / numOfDirections;
          var numOfCircles = 6;
          var maxColorVal = Math.floor(getMinMaxVelocity(velocities)[1] / windSpeedStep);

          _.each(directions, function (point, time) {
              if (point >= 360 - alpha/2) {
                  point -= 360;
              }
              var segment = parseInt((point + alpha/2) / alpha);
              if ( velocities[time] == 0) {
                  totalPercents[0] +=1;
                  return;
              }
              if (res[segment]) {
                  res[segment].push([velocities[time], +time]);
              } else {
                  res[segment] = [[velocities[time], +time]];
              }
          });

          var maxSegment = 0;
          _.each(res, function (segment) {
              if (segment.length > maxSegment) {
                  maxSegment = segment.length;
              }
          });

          var zeroR = radius * totalPercents[0] / velocitiesArray.length;
          var maxPercentInScale = 0;

          _.each(res, function (segment, i) {
              var innerSegments = _.groupBy(segment, function (point) {
                  return parseInt(point[0]/windSpeedStep);
              });

              var angleOffset = 1;
              var startAngleInit = -1 * alpha/2 + i*alpha;
              var endAngleInit = startAngleInit + alpha;
              var startAngle = (startAngleInit + angleOffset) * Math.PI / 180;
              var endAngle = (endAngleInit - angleOffset) * Math.PI / 180;
              var innerR = zeroR;
              var outerR = (radius - zeroR - 20) * segment.length / maxSegment;

              percents[i] = [];

              _.each(innerSegments, function (innerSegment, v) {
                  var innerSegmentOuterR = innerR + outerR * innerSegment.length / segment.length;
                  var color = getColorAtPoint(+v, 0, maxColorVal, chartColors);
                  var arc = d3.svg.arc()
                                  .innerRadius(innerR)
                                  .outerRadius(innerSegmentOuterR)
                                  .startAngle(startAngle)
                                  .endAngle(endAngle);

                  d.push({arc: arc, color: color, percents: percents[i], startAngle: startAngleInit, endAngle: endAngleInit});

                  innerR = innerSegmentOuterR;
                  if ( ! totalPercents[+v + 1]) {
                      totalPercents[+v + 1] = 0;
                  }
                  totalPercents[+v + 1] += innerSegment.length;
                  var innerSegmentPercents = Math.round((innerSegment.length * 100 / segment.length) * 10) / 10;
                  percents[i].push({val: innerSegmentPercents, color: color});
              });
              var segmentPercents = Math.round((segment.length * 100 / velocitiesArray.length) * 10) / 10;
              if (segmentPercents > maxPercentInScale) {
                  maxPercentInScale = segmentPercents;
              }
              percents[i].push({val: segmentPercents});
          });

          maxPercentInScale = maxPercentInScale * radius / (radius - 20);

          var percentsScale = [];
          for (var i = 0; i < numOfCircles; i++) {
              percentsScale.push(Math.round((maxPercentInScale - i * maxPercentInScale / numOfCircles) * 10) / 10);
          }

          totalPercents = _.map(totalPercents, function (num) {
              return Math.round((num * 100 / velocitiesArray.length) * 10) / 10;
          });

          buildChart(d);
          buildChartCircumferences(numOfCircles);
          buildPercentsScale(numOfCircles, percentsScale, percentsPosition);
          buildChartScale(maxColorVal);
          buildChartScaleLabels(windSpeedStep, maxColorVal, totalPercents);

          toggleWindRoseType('chart');
      }

      function renderPoints (preparedSpeeds) {
          var alphaBlending = options.alphaBlending;
          var alphaBlendingMinOpacity = options.alphaBlendingMinOpacity || 0;
          var gradientBasedOn = options.gradientBasedOn;
          var lastPointColor = options.lastPointColor;
          var dotColors = options.dotColors;
          var new_points = [];
          var filtredAngles = {};
          var filtredVelocities = {};

          if (!preparedData || !preparedData.direction) {
              return;
          }

          var directions = preparedData.direction.datapoints;
          var timeKeysArray = Object.keys(directions);
          var main_speed = preparedData.speeds.speed_main ? preparedData.speeds.speed_main.datapoints : [];
          var minMaxTime = [timeKeysArray[0], timeKeysArray[timeKeysArray.length - 1]]; //returns [min,max] time
          var diffTime = minMaxTime[1] - minMaxTime[0];

          var prepared_main_speed = preparedSpeeds.speed_main ? preparedSpeeds.speed_main.datapoints : [];

          var colorsObj = getColorsObj();

          _.each(main_speed, function (point, i) {
              if (point <= maxV) {
                    filtredAngles[i] = directions[i];
                    filtredVelocities[i] = main_speed[i];
              }
          });

          var realMinMaxV = getMinMaxVelocity(prepared_main_speed); //returns [min, max]

          var getColor = function (i) {
              if (i == minMaxTime[1]) {
                  return lastPointColor;
              }
              var pointVal, pointMinVal, pointMaxVal;
              if (gradientBasedOn == 'age') {
                  pointVal = +i;
                  pointMinVal = +minMaxTime[0];
                  pointMaxVal = +minMaxTime[1];
              } else {
                  if (!colorsObj) {
                      return;
                  }
                  var colorsArr = _.toArray(colorsObj);
                  pointVal = colorsObj[i];
                  pointMinVal = _.min(colorsArr);
                  pointMaxVal = _.max(colorsArr);
              }
              return getColorAtPoint(pointVal, pointMinVal, pointMaxVal, dotColors);
          };

          _.each(filtredAngles, function (point, i) {
              var alpha = point;
              var init_alpha = alpha;

              if (init_alpha >= 90 && init_alpha < 270) {
                  alpha = Math.abs(alpha - 180);
              }
              if (init_alpha >= 270 && init_alpha < 360) {
                  alpha = Math.abs(alpha - 360);
              }
              var x = Math.sin(alpha * Math.PI / 180) * prepared_main_speed[i];
              if (init_alpha > 180) {
                  x *= -1;
              }

              var y = Math.sqrt(prepared_main_speed[i] * prepared_main_speed[i] - x * x);
              y *= -1;
              if (init_alpha > 90 && init_alpha < 270) {
                  y *= -1;
              }
              var color = getColor(i);
              var d = {
                x: x,
                y: y,
                opacity: alphaBlending ? 1 - (minMaxTime[1] - i) / diffTime + alphaBlendingMinOpacity : 1,
                color: color,
                time: moment(+i).format('YYYY-MM-DD HH:mm:ss'),
                wind_speed: Math.round(filtredVelocities[i] * 100)/100 + ' m/s',
                wind_dir: Math.round(point) + '\u00B0'
              };
              if (gradientBasedOn != 'age' && gradientBasedOn != 'wind_speed') {
                  d.extra = {
                      title: gradientBasedOn,
                      val: Math.round(colorsObj[i] * 100) / 100
                  };
              }
              new_points.push(d);
          });
          buildPoints(new_points);
      }

      function renderPointsPanel () {
          if (!preparedData || !preparedData.direction) {
              return;
          }

          var preparedSpeeds = prepareSpeeds();

          buildScale();
          buildStrokesLabels();
          buildCircumferences();
          buildColoredScale();
          buildColoredScaleLabels();

          renderPoints(preparedSpeeds);
          renderExtraLines(preparedSpeeds);

          toggleWindRoseType('points');
      }

      //helpers
      function guid() {
          function s4() {
              return Math.floor((1 + Math.random()) * 0x10000)
                         .toString(16)
                         .substring(1);
          }
          return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
      }

      function getColorAtPoint (val, minVal, maxVal, colors) {
          if (colors.length == 1) {
              return colors[0];
          }
          Rainbow.setSpectrumByArray(colors);
          Rainbow.setNumberRange(minVal, maxVal);
          return '#' + Rainbow.colourAt(val);
      }

      function generateRandomColors (length) {
          if (randomColors.length >= length) {
              return;
          }
          var letters = '0123456789ABCDEF';
          for (var j = 0; j < length - randomColors.length; j++) {
              var color = '#';
              for (var i = 0; i < 6; i++ ) {
                  color += letters[Math.floor(Math.random() * 16)];
              }
              randomColors.push(color);
          }
      }

      function getColorsObj () {
          var gradientBasedOn = options.gradientBasedOn;
          var  colorsObj = null;

          if (gradientBasedOn != 'age') {
              var colorBasedOnSpeed = _.find(preparedData.speeds, function (speed) {
                  return speed.alias.split('[')[0] == gradientBasedOn;
              });
              if (colorBasedOnSpeed) {
                  colorsObj = colorBasedOnSpeed['datapoints'];
              }
              if (preparedData.color && preparedData.color[gradientBasedOn]) {
                  colorsObj = preparedData.color[gradientBasedOn]['datapoints'];
              }
              if (!colorsObj) {
                  scope.ctrl.panel.windRoseOptions.gradientBasedOn = 'age';
                  options.gradientBasedOn = 'age';
              }
          }
          return colorsObj;
      }

      function getMinMaxVelocity (velocities) {
          var min, max;
          var time = Object.keys(velocities);
          min = max = velocities[time[0]];
          _.each(velocities, function (v) {
              if (v < min) {
                  min = v;
              }
              if (v > max) {
                  max = v;
              }
          });
          return [min, max];
      }

      function prepareSpeeds () {
          var scale = options.scale;
          var defaultMaxV = options.maxV;
          var logBase = null;

          ticks = [];

          var speeds = angular.copy(preparedData.speeds);

          var getMaxV = function () {
              if (defaultMaxV) {
                  return defaultMaxV;
              }
              var max = 0;
              _.each(speeds, function (item) {
                  var current_max = _.chain(item.datapoints).toArray().max().value();
                  if (current_max > max) {
                      max = current_max;
                  }
              });
              return max;
          };

          maxV = getMaxV();

          if (scale == 'square') {
              _.each(speeds, function (item) {
                  _.each(item.datapoints, function (point, i) {
                      item.datapoints[i] *= point;
                  });
              });
              maxV = defaultMaxV ? maxV : Math.ceil(maxV);
              ticks = _.range(maxV + 1);
              ticks[ticks.length - 1] = maxV;
              maxV *= maxV;
          }
          if (~scale.indexOf('log')) {
              logBase = scale.match(/\d+/)[0];
              ticks = [0, 1];
              var currentTick = 1;
              while (maxV > currentTick) {
                  currentTick = currentTick *  logBase;
                  currentTick = defaultMaxV && currentTick > maxV ? maxV : currentTick;
                  ticks.push(currentTick);
              }

              var minV = Math.log(0.1) / Math.log(logBase);
              maxV = Math.log(ticks[ticks.length - 1]) / Math.log(logBase);
              maxV += Math.abs(minV);

              _.each(speeds, function (item) {
                  _.each(item.datapoints, function (point, i) {
                      item.datapoints[i] = Math.log(point + 0.1) / Math.log(logBase);
                      item.datapoints[i] += Math.abs(minV);
                  });
              });
          }
          if (scale == 'linear') {
              maxV = defaultMaxV ? maxV : Math.ceil(maxV * 2) / 2;
              var scaleStep = 0.5;
              while (maxV/scaleStep > 7) {
                  scaleStep += 0.5;
              }
              for (var i=0; i <= maxV; i += scaleStep) {
                  ticks.push(i);
              }
              if (ticks[ticks.length - 1] != maxV) {
                  ticks.push(maxV);
              }
          }

          _.each(speeds, function (item) {
              _.each(item.datapoints, function (point, i) {
                  item.datapoints[i] = point * radius / maxV;
              });
          });
          return speeds;
      }

      function prepareData () {
          dataDirections = [];
          dataVelocities = [];
          preparedData = {};
          extraData = {};
          if (!data || !data[0] || !data[0]['datapoints'] || !data[1] || !data[1]['datapoints']) {
              return;
          }
          var colors = 0;
          _.each(data, function (item) {
              var alias = item.alias;
              if (!alias) {
                  return;
              }
              var key = alias.match(/\[(.*)\]/);
              if (!key || !key[1]) {
                  return;
              }
              key = key[1];
              var datapoints = trimDatapoints(item.datapoints);
              datapoints = createTimedIndex(datapoints);
              switch (key) {
                  case 'direction':
                      preparedData[key] = {
                          datapoints: datapoints,
                          alias: alias
                      };
                      break;
                  case 'speed_min':
                  case 'speed_max':
                  case 'speed_avg':
                      colors++;
                  case 'speed_main':
                  case 'speed_min':
                  case 'speed_max':
                  case 'speed_avg':
                      if (!preparedData['speeds']) {
                          preparedData['speeds'] = {};
                      }
                      preparedData['speeds'][key] = {
                          datapoints: datapoints,
                          alias: alias
                      };
                      break;
                  case 'color':
                      if (!preparedData['color']) {
                          preparedData['color'] = {};
                      }
                      var colorKey = alias.split('[')[0];
                      preparedData['color'][colorKey] = {
                          datapoints: datapoints,
                          alias: alias
                      };
                      break;
              }
          });
          generateRandomColors(colors);
      }

      function trimDatapoints(datapoints) {
          var startIndex = 0;
          var endIndex = datapoints.length > 1 ? datapoints.length - 1 : 0;
          for (var i = startIndex, l = datapoints.length; i < l; i++) {
              startIndex = i;
              if (!isNaN(parseFloat(datapoints[i][0]))) {
                  break;
              }
          }
          for (var i = endIndex; i > -1; i--) {
              endIndex = i;
              if (!isNaN(parseFloat(datapoints[i][0]))) {
                  break;
              }
          }
          return datapoints.slice(startIndex, endIndex + 1);
      }

      function createTimedIndex(datapoints) {
          var timedIndex = {};
          var timeKey, dataValue;
          for (var i = 0, l = datapoints.length; i < l; i++) {
              timeKey = datapoints[i][1];
              dataValue = datapoints[i][0];
              if (!isNaN(parseFloat(dataValue))) {
                  timedIndex[timeKey] = dataValue;
              }
          }
          return timedIndex;
      }

      ctrl.events.on('render', function (renderData) {
          data = renderData || data;
          if (!data || !options.windRoseType) {
              ctrl.refresh();
              return;
          }
          prepareData();
          if (options.windRoseType == 2) {
                return renderChart();
          }
          return renderPointsPanel();
      });

      //WATCHERS
      scope.$watch('ctrl.panel.windRoseOptions.axisFrequency', function (newVal) {
          options.axisFrequency = newVal;
          buildAxis();
          if (options.labelDegrees) {
              styleAxisLabels();
          }
      });

      scope.$watch('ctrl.panel.windRoseOptions.axisName', function (newVal) {
          options.axisName = newVal;
          setAxisName();
      });

      scope.$watch('ctrl.panel.windRoseOptions.scale', function (newVal) {
          options.scale = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.maxV', function (newVal) {
          options.maxV = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.gradientBasedOn', function (newVal) {
          options.gradientBasedOn = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.dotColors', function (newVal) {
          options.dotColors = _.chain(newVal).filter(function (color) {
                return color.val;
          }).map(function (color) {
                return color.val;
          }).value();
          if (!options.dotColors.length) {
                options.dotColors = ['#000000'];
          }
          renderPointsPanel();
      }, true);

      scope.$watch('ctrl.panel.windRoseOptions.lastPointColor', function (newVal) {
          options.lastPointColor = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.alphaBlending', function (newVal) {
          options.alphaBlending = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.alphaBlendingMinOpacity', function (newVal) {
          if (newVal < 0) {
                scope.ctrl.panel.windRoseOptions.alphaBlendingMinOpacity = 0;
          }
          if (newVal > 1) {
                scope.ctrl.panel.windRoseOptions.alphaBlendingMinOpacity = 1;
          }
          options.alphaBlendingMinOpacity = newVal || 0;
          renderPointsPanel();
      });

      //labels
      scope.$watch('ctrl.panel.windRoseOptions.labelDegrees', function (newVal) {
          options.labelDegrees = newVal;
          styleAxisLabels();
      });

      scope.$watch('ctrl.panel.windRoseOptions.labelCardinalCompass', function (newVal) {
          options.labelCardinalCompass = newVal;
          styleAxisLabels();
      });

      scope.$watch('ctrl.panel.windRoseOptions.labelIntercardinalCompass', function (newVal) {
          options.labelIntercardinalCompass = newVal;
          styleAxisLabels();
      });

      scope.$watch('ctrl.panel.windRoseOptions.labelCompassRose', function (newVal) {
          options.labelCompassRose = newVal;
          addCompassRoseAsBackground();
      });

      scope.$watch('ctrl.panel.windRoseOptions.labelCompassRoseOpacity', function (newVal) {
          if (newVal < 0) {
              scope.ctrl.panel.windRoseOptions.labelCompassRoseOpacity = 0;
          }
          if (newVal > 1) {
              scope.ctrl.panel.windRoseOptions.labelCompassRoseOpacity = 1;
          }
          options.labelCompassRoseOpacity = newVal;
          setCompassRoseOpacity();
      });

      scope.$watch('ctrl.panel.windRoseOptions.labelCompassRoseSize', function (newVal) {
          if (newVal < 0) {
              scope.ctrl.panel.windRoseOptions.labelCompassRoseSize = 0;
          }
          if (newVal > 1) {
              scope.ctrl.panel.windRoseOptions.labelCompassRoseSize = 1;
          }
          options.labelCompassRoseSize = newVal;
          defineBg();
      });

      //pie chart
      scope.$watch('ctrl.panel.windRoseOptions.windRoseType', function (newVal) {
          options.windRoseType = newVal;
          if (options.windRoseType == 2) {
                return renderChart();
          }
          return renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.numOfDirections', function (newVal) {
          options.numOfDirections = newVal;
          renderChart();
      });

      scope.$watch('ctrl.panel.windRoseOptions.windSpeedStep', function (newVal) {
          options.windSpeedStep = newVal;
          renderChart();
      });

      scope.$watch('ctrl.panel.windRoseOptions.chartColorFrom', function (newVal) {
          options.chartColorFrom = newVal;
          renderChart();
      });

      scope.$watch('ctrl.panel.windRoseOptions.chartColorTo', function (newVal) {
          options.chartColorTo = newVal;
          renderChart();
      });

      scope.$watch('ctrl.panel.windRoseOptions.showPercents', function (newVal) {
          options.showPercents = newVal;
          togglePercents();
      });

      scope.$watch('ctrl.panel.windRoseOptions.percentsPosition', function (newVal) {
          options.percentsPosition = newVal;
          renderChart();
      });

      scope.$watch('ctrl.panel.windRoseOptions.chartOpacity', function (newVal) {
          if (newVal < 0) {
              scope.ctrl.panel.windRoseOptions.chartOpacity = 0;
          }
          if (newVal > 1) {
              scope.ctrl.panel.windRoseOptions.chartOpacity = 1;
          }
          options.chartOpacity = newVal;
          setChartOpacity();
      });

      scope.$watch('ctrl.panel.windRoseOptions.chartColors', function (newVal) {
          options.chartColors = _.chain(newVal).filter(function (color) {
              return color.val;
          }).map(function (color) {
              return color.val;
          }).value();
          if (!options.chartColors.length) {
              options.chartColors = ['#000000'];
          }
          renderChart();
      }, true);

      //peaks
      scope.$watch('ctrl.panel.windRoseOptions.peakTypeBar', function (newVal) {
          options.peakTypeBar = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.peakTypeLine', function (newVal) {
          options.peakTypeLine = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.peakTypePoints', function (newVal) {
          options.peakTypePoints = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.peakTypeLineFill', function (newVal) {
          options.peakTypeLineFill = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.peakTypeLineWidth', function (newVal) {
          options.peakTypeLineWidth = newVal;
          renderPointsPanel();
      });

      scope.$watch('ctrl.panel.windRoseOptions.peakTypePointsRadius', function (newVal) {
          options.peakTypePointsRadius = newVal;
          renderPointsPanel();
      });

      //INIT
      init();

      elem.removeAttr('grafana-wind-rose');
    }
  };
});
