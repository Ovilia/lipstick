var zr = null;
var bgDpi = 0.2;
var zrDpi = 1;
var width = 0;
var height = 0;
var lipstickData = null;

function init() {
    width = Math.floor(window.innerWidth * bgDpi);
    height = Math.floor(window.innerHeight * bgDpi);

    var bgDom = document.getElementById('bg');
    bgDom.setAttribute('width', width);
    bgDom.setAttribute('height', height);

    var zrDom = document.getElementById('zr');
    zrDom.setAttribute('width', window.innerWidth * zrDpi);
    zrDom.setAttribute('height', window.innerHeight * zrDpi);
    zr = zrender.init(zrDom);

    $.getJSON('dist/lipstick.json', function (data) {
        updateLipstickData(data);

        var minMax = getMinMax(lipstickData);
        renderBackground(bgDom, minMax);
        renderDataPoints(lipstickData, minMax);

        hover({ target: lipstickData[0].group.childAt(0) });
        updateUi(lipstickData[0]);
        document.getElementById('ui').setAttribute('style', 'display:block');
    });
}

function updateLipstickData(rawData) {
    lipstickData = [];
    for (var bid = 0, blen = rawData.brands.length; bid < blen; ++bid) {
        var brand = rawData.brands[bid];
        for (var sid = 0, slen = brand.series.length; sid < slen; ++sid) {
            var lipsticks = brand.series[sid].lipsticks;
            lipstickData = lipstickData.concat(lipsticks);
            for (var lid = 0, llen = lipsticks.length; lid < llen; ++lid) {
                lipsticks[lid].series = brand.series[sid];
                lipsticks[lid].brand = brand;
            }
        }
    }
}

function getMinMax(lipstickData) {
    var minHue = Number.MAX_VALUE;
    var maxHue = Number.MIN_VALUE;
    var minLight = Number.MAX_VALUE;
    var maxLight = Number.MIN_VALUE;
    for (var i = 0; i < lipstickData.length; ++i) {
        var hsl = tinycolor(lipstickData[i].color).toHsl();
        hsl.l *= 100;
        lipstickData[i]._hsl = hsl;

        var hue = encodeHue(hsl.h);
        if (hue < 165 || hue > 220) {
            // ignore rare colors
            continue;
        }

        if (hue > maxHue) {
            maxHue = hue;
        }
        if (hue < minHue) {
            minHue = hue;
        }

        var light = hsl.l;
        if (light > maxLight) {
            maxLight = light;
        }
        if (light < minLight) {
            minLight = light;
        }
    }
    return {
        minHue: minHue - 2,
        maxHue: maxHue + 2,
        minLight: Math.max(minLight - 10, 0),
        maxLight: Math.min(maxLight + 5, 100)
    };
}

function renderBackground(bgDom, minMax) {
    var ctx = bgDom.getContext('2d');
    var imgData = ctx.createImageData(width, height);
    var data = imgData.data;

    for (var y = 0; y < height; ++y) {
        for (var x = 0; x < width; ++x) {
            var light = (height - y) / height * (minMax.maxLight - minMax.minLight) + minMax.minLight;
            var hue = x / width * (minMax.maxHue - minMax.minHue) + minMax.minHue;
            var color = tinycolor({
                h: encodeHue(hue),
                s: 80,
                l: light
            });
            var rgb = color.toRgb();
            var id = (y * width + x) * 4;
            data[id] = rgb.r;
            data[id + 1] = rgb.g;
            data[id + 2] = rgb.b;
            data[id + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

function renderDataPoints(lipstickData, minMax) {
    for (var i = 0; i < lipstickData.length; ++i) {
        var coord = getDataCoord(lipstickData[i], minMax);
        var pos = [coord.x * zrDpi, coord.y * zrDpi];
        var point = new zrender.Circle({
            shape: {
                cx: 0,
                cy: 0,
                r: 5
            },
            style: {
                fill: lipstickData[i].color,
                stroke: 'rgba(255, 255, 255, 0.8)',
                lineWidth: 1
            },
            position: pos,
            z: 1
        });

        var text = new zrender.Text({
            style: {
                text: lipstickData[i].name,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontSize: 12,
                textFill: 'rgba(255, 255, 255, 0.5)'
            },
            position: [pos[0], pos[1] + 16]
        });

        var group = new zrender.Group();
        group.add(point);
        group.add(text);
        zr.add(group);

        group.lipstick = lipstickData[i];
        group.lipstick.group = group;
    }

    zr.on('mousemove', hover);
    zr.on('click', function () {
        if (!lastEmphasisGroup) {
            normal(notNormalGroups);
            notNormalGroups = [];
        }
    });
}

var lastEmphasisGroup = null;
var notNormalGroups = [];
function hover(el) {
    // unhover last group
    if ((!el.target || el.target.parent !== lastEmphasisGroup) && notNormalGroups.length) {
        normal(notNormalGroups);
        notNormalGroups = [];
    }

    if (el.target) {
        if (lastEmphasisGroup !== el.target.parent) {
            // hover current
            var group = el.target.parent;
            emphasis(group);
            notNormalGroups = [group];

            var lipstick = group.lipstick;
            var siblings = lipstick.series.lipsticks;

            for (var i = 0; i < lipstickData.length; ++i) {
                var l = lipstickData[i];
                if (l !== lipstick) {
                    if (siblings.indexOf(l) > -1) {
                        relate(l.group);
                        notNormalGroups.push(l.group);
                    }
                    else {
                        downplay(l.group);
                    }
                }
            }

            lastEmphasisGroup = el.target.parent;
        }
    }
    else if (lastEmphasisGroup) {
        for (var i = 0; i < lipstickData.length; ++i) {
            undownplay(lipstickData[i].group);
        }
        lastEmphasisGroup = null;
    }
}

function emphasis(group) {
    undownplay(group);

    var point = group.childAt(0);
    point.attr('z', 11);
    point.stopAnimation(true);
    point.animateTo({
        shape: {
            r: 30
        },
        style: {
            lineWidth: 3,
            stroke: '#fff',
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, 0.4)'
        }
    }, 200, 0, 'bounceOut');

    var text = group.childAt(1);
    text.attr('z', 10);
    text.attr('style', {
        text: '#' + group.lipstick.id + ' ' + group.lipstick.name,
        textPadding: [62, 0, 0, 0]
    });
    text.stopAnimation(true);
    text.animateTo({
        style: {
            textFill: group.lipstick.color,
            fontSize: 16,
            textStrokeWidth: 3,
            textStroke: '#fff'
        }
    }, 200, 0, 'bounceOut');

    updateUi(group.lipstick);
}

function relate(group) {
    undownplay(group);

    var point = group.childAt(0);
    point.stopAnimation(true);
    point.attr('style', {
        lineWidth: 2
    });
    point.attr('z', 9);
    point.attr('shape', {
        r: 10
    });
    point.animateTo({
        style: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
        }
    }, 200, 0, 'bounceOut');

    var text = group.childAt(1);
    text.attr('style', {
        text: '#' + group.lipstick.id + ' ' + group.lipstick.name,
        textPadding: [12, 0, 0, 0]
    });
    text.attr('z', 8);
    text.stopAnimation(true);
    text.animateTo({
        style: {
            textFill: group.lipstick.color,
            textStrokeWidth: 2,
            textStroke: 'rgba(255, 255, 255, 0.75)'
        }
    }, 200, 0, 'bounceOut');
}

function normal(groups) {
    for (var i = 0; i < groups.length; ++i) {
        var point = groups[i].childAt(0);
        point.attr('z', 1);
        point.stopAnimation(true);
        point.animateTo({
            shape: {
                r: 5
            },
            style: {
                stroke: 'rgba(255, 255, 255, 0.8)',
                lineWidth: 1,
                shadowBlur: 0
            }
        }, 200, 0, 'linear');

        var text = groups[i].childAt(1);
        text.stopAnimation(true);
        text.attr('style', {
            text: groups[i].lipstick.name,
            textPadding: 0
        });
        text.attr('z', 0);
        text.animateTo({
            style: {
                fontSize: 12,
                textStrokeWidth: 0,
                textShadowBlur: 0,
                textFill: 'rgba(255, 255, 255, 0.5)'
            }
        }, 200, 0, 'linear');
    }
}

function downplay(group) {
    var point = group.childAt(0);
    point.stopAnimation(true);
    point.animateTo({
        style: {
            opacity: 0.6
        }
    }, 200, 0, 'linear');

    var text = group.childAt(1);
    text.stopAnimation(true);
    text.animateTo({
        style: {
            opacity: 0
        }
    }, 200, 0, 'linear');
}

function undownplay(group) {
    var point = group.childAt(0);
    point.stopAnimation(true);
    point.animateTo({
        style: {
            opacity: 1
        }
    }, 200, 0, 'linear');

    var text = group.childAt(1);
    text.stopAnimation(true);
    text.animateTo({
        style: {
            opacity: 1
        }
    }, 200, 0, 'linear');
}

function getDataCoord(data, minMax) {
    var hue = encodeHue(data._hsl.h);
    var light = data._hsl.l;
    return {
        x: (hue - minMax.minHue) * width / (minMax.maxHue - minMax.minHue) / bgDpi,
        y: height / bgDpi - (light - minMax.minLight) * height / (minMax.maxLight - minMax.minLight) / bgDpi
    };
}

/**
 * convert red hue to be around 0.5
 */
function encodeHue(hue) {
    if (hue < 180) {
        return 180 - hue;
    }
    else {
        return 540 - hue;
    }
}

function updateUi(lipstick) {
    document.getElementById('brand-name').innerText = lipstick.brand.name;
    document.getElementById('series-name').innerText = lipstick.series.name;
    document.getElementById('lipstick-id').innerText = lipstick.id;
    document.getElementById('lipstick-name').innerText = lipstick.name;
    document.getElementById('lipstick-info').setAttribute('style', 'color:' + lipstick.color);

    var seriesColors = document.getElementById('series-colors');
    seriesColors.innerText = '';

    var siblings = lipstick.series.lipsticks;
    for (var i = 0; i < siblings.length; ++i) {
        var el = document.createElement('div');
        el.setAttribute('style', 'background-color:' + siblings[i].color);

        var className = siblings[i] === lipstick ? 'series-color active' : 'series-color';
        el.setAttribute('class', className);
        seriesColors.appendChild(el);
    }
}
