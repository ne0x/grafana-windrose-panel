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

## Installation

### Manual Install

Just checkout this repo inside your grafana plugins directory, usually located
at `/var/lib/grafana/plugins`, and restart `grafana-server` so it registers the
new plugin.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## History

##### 1.1.1 (12/17)

Initial release

## License

The FreeBSD License

Copyright (c) 2016,2017, Kantonsschule Zug, Lussiweg 24, CH6302 Zug, Switzerland.

See [LICENSE](LICENSE) for details