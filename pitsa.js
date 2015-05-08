module.exports = function(browser) {
	var fs = require('fs');
	var path = require('path');


  var capture = function () {
    var name = jasmine.getEnv().currentSpec.getFullName().replace(/ /g, '_');

    return browser.takeScreenshot().then(function (png) {
        var image_path = path.join(jasmine.getEnv().SCREENSHOT_DIR || 'screenshots', name + '.png');
        var stream = fs.createWriteStream(image_path);
        stream.write(new Buffer(png, 'base64'));
        stream.end();
        return image_path;
    });
  };

  var screenshot = function () {
    if (!!process.env.CAPTURE_SCREENSHOTS){
      return capture();
    }
  };

  return {screenshot: screenshot};
};
