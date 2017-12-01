'use strict';

System.register([], function (_export, _context) {
    "use strict";

    return {
        setters: [],
        execute: function () {
            angular.module('grafana.services').factory('Rainbow', function () {
                var gradients = null;
                var minNum = 0;
                var maxNum = 100;
                var colours = ['ff0000', 'ffff00', '00ff00', '0000ff'];

                return {
                    setSpectrum: function setSpectrum() {
                        setColours(arguments);
                        return this;
                    },
                    setSpectrumByArray: function setSpectrumByArray(array) {
                        setColours(array);
                        return this;
                    },
                    colourAt: function colourAt(number) {
                        if (isNaN(number)) {
                            throw new TypeError(number + ' is not a number');
                        } else if (gradients.length === 1) {
                            return gradients[0].colourAt(number);
                        } else {
                            var segment = (maxNum - minNum) / gradients.length;
                            var index = Math.min(Math.floor((Math.max(number, minNum) - minNum) / segment), gradients.length - 1);
                            return gradients[index].colourAt(number);
                        }
                    },
                    setNumberRange: function setNumberRange(minNumber, maxNumber) {
                        if (maxNumber > minNumber) {
                            minNum = minNumber;
                            maxNum = maxNumber;
                            setColours(colours);
                        } else {
                            throw new RangeError('maxNumber (' + maxNumber + ') is not greater than minNumber (' + minNumber + ')');
                        }
                        return this;
                    }
                };

                function setColours(spectrum) {
                    if (spectrum.length < 2) {
                        throw new Error('Rainbow must have two or more colours.');
                    } else {
                        var increment = (maxNum - minNum) / (spectrum.length - 1);
                        var firstGradient = ColourGradient();
                        firstGradient.setGradient(spectrum[0], spectrum[1]);
                        firstGradient.setNumberRange(minNum, minNum + increment);
                        gradients = [firstGradient];

                        for (var i = 0; i < spectrum.length - 1; i++) {
                            var colorGradient = ColourGradient();
                            colorGradient.setGradient(spectrum[i], spectrum[i + 1]);
                            colorGradient.setNumberRange(minNum + increment * i, minNum + increment * (i + 1));
                            gradients[i] = colorGradient;
                        }
                        colours = spectrum;
                    }
                }

                function ColourGradient() {
                    var startColour = 'ff0000';
                    var endColour = '0000ff';
                    var minNum = 0;
                    var maxNum = 100;

                    return {
                        setGradient: function setGradient(colourStart, colourEnd) {
                            startColour = getHexColour(colourStart);
                            endColour = getHexColour(colourEnd);
                        },
                        setNumberRange: function setNumberRange(minNumber, maxNumber) {
                            if (maxNumber > minNumber) {
                                minNum = minNumber;
                                maxNum = maxNumber;
                            } else {
                                throw new RangeError('maxNumber (' + maxNumber + ') is not greater than minNumber (' + minNumber + ')');
                            }
                        },
                        colourAt: function colourAt(number) {
                            return calcHex(number, startColour.substring(0, 2), endColour.substring(0, 2)) + calcHex(number, startColour.substring(2, 4), endColour.substring(2, 4)) + calcHex(number, startColour.substring(4, 6), endColour.substring(4, 6));
                        }
                    };

                    function calcHex(number, channelStart_Base16, channelEnd_Base16) {
                        var num = number;
                        if (num < minNum) {
                            num = minNum;
                        }
                        if (num > maxNum) {
                            num = maxNum;
                        }
                        var numRange = maxNum - minNum;
                        var cStart_Base10 = parseInt(channelStart_Base16, 16);
                        var cEnd_Base10 = parseInt(channelEnd_Base16, 16);
                        var cPerUnit = (cEnd_Base10 - cStart_Base10) / numRange;
                        var c_Base10 = Math.round(cPerUnit * (num - minNum) + cStart_Base10);
                        return formatHex(c_Base10.toString(16));
                    }

                    function formatHex(hex) {
                        if (hex.length === 1) {
                            return '0' + hex;
                        } else {
                            return hex;
                        }
                    }

                    function isHexColour(string) {
                        var regex = /^#?[0-9a-fA-F]{6}$/i;
                        return regex.test(string);
                    }

                    function getHexColour(string) {
                        if (isHexColour(string)) {
                            return string.substring(string.length - 6, string.length);
                        } else {
                            throw new Error(string + ' is not a valid colour.');
                        }
                    }
                }
            });
        }
    };
});
//# sourceMappingURL=gradient.js.map
