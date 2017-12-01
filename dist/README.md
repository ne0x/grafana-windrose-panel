## Wind Rose (d3) Panel Plugin for Grafana

**Caution: This plugin is NOT stable yet, if you find some bugs, please report me :-)**

### How this plugin works

This plugin receives raw time series data (wind speed and wind direction), and convert the data to wind rose in plugin side, and then show it.

Make histogram data in fixed short time range. Please calibrate the option to fit your needs.

### Supported Datasources

I confirmed this plugin work with following datasource.

- InfluxDB

But, this plugin can handle time series data (defined by Grafana plugin interface).

Should work with Graphite / OpenTSDB / Prometheus.

### Options

Support the following options:

- Axis Frequency
- Axis Style (degrees or compass)
- Scale (linear, square, log)
