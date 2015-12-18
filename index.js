var postcss = require('postcss');
var fs = require('fs');
var path = require('path');

var onecolor = require('onecolor');

/**
 * Calculate the lumninance of a color using the formula found in WCAG 2.0.
 *
 * See http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
 */
function luminance(color) {
	var calc = function(part) {
		return part < 0.03928 ?
			part / 12.92 :
			Math.pow((part + 0.055) / 1.055, 2.4);
	};

	return 0.2125 * calc(color.red()) + 0.7152 * calc(color.green()) + 0.0722 * calc(color.blue());
}

/**
 * Determine the contrast ratio between two colors.
 *
 * See http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
 */
function contrast(background, foreground) {
	background = onecolor(background);
	foreground = onecolor(foreground);

	var l1 = luminance(background) + 0.05;
	var l2 = luminance(foreground) + 0.05;
	var ratio = l1 / l2;

	if(l2 > l1) {
		ratio = 1 / ratio;
	}

	return ratio;
}

/**
 * Calculate the foreground and border color from a background.
 */
function createColors(background) {
	var color = onecolor(background);
	var result = {
		background: background
	};

	if(! color) return result;

	if(contrast(color, 'black') >= 4.5) {
		result.color = 'black';
		result.border = color.lightness(Math.max(color.lightness() - 0.3, 0)).hex();
	} else {
		result.color = 'white';
		result.border = color.lightness(Math.min(color.lightness() + 0.3, 1)).hex();
	}

	return result;
}

/**
 * Take a selector and calculate a stable grey background for it.
 */
function stringToColor(selector) {
	var hash = selector.split('')
		.reduce(function(a, b) {
			a = ((a << 5)-a) + b.charCodeAt(0);
			return a&a;
		}, 0);

	var c = 100 + (hash % 100);
	return 'rgba(' + c + ',' + c + ', ' + c + ', 0.8)';
}

function handleMixin(rule) {
	var params = rule.params.trim().split(/\s+/);

	var properties = [];
	properties.push({ prop: 'font-family', value: 'Comic Neue' });

	// Determine background color and if we should outline
	var background = null;
	var outline = false;
	for(var i=0; i<params.length; i++) {
		if(i == 0 && params[i] === 'auto') {
			background = stringToColor(rule.parent.selector);
		} else if(params[i] === 'outline') {
			outline = true;
		} else if(i == 0) {
			background = params[i];
		}
	}

	// Resolve colors and output background if needed
	var colors;
	if(background) {
		colors = createColors(background);

		properties.push({ prop: 'background-color', value: colors.background });
		properties.push({ prop: 'color', value: colors.color });
		properties.push({ prop: 'padding', value: '1rem' });
	} else {
		colors = {
			border: '#aaa'
		};
	}

	// Output the wireframe border
	if(outline) {
		properties.push({ prop: 'border', value: '2px solid ' + colors.border });

		if(! background) {
			properties.push({ prop: 'padding', value: '1rem' });
		}
	}

	rule.replaceWith(properties.map(function(prop) {
		return postcss.decl(prop);
	}));
}

/**
 * Add common CSS to the stylesheet.
 */
function addCommon(css) {
	var wireframeCss = fs.readFileSync(path.join(__dirname, 'wireframe.css'));
	css.prepend(postcss.parse(wireframeCss));
}

module.exports = postcss.plugin('wireframe', function(opts) {
    opts = opts || {};

    return function(css, result) {
        var addedCommon = false;

		css.eachAtRule(function(rule) {
			if(rule.name == 'wireframe') {
				if(! addedCommon) {
					addCommon(css);
					addedCommon = true;
				}

				handleMixin(rule);
			}
		});
    };
});
