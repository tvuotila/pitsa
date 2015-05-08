#!/usr/bin/env node
var pitsa = module.exports = {
  async: require('async'),
  archiver: require('archiver'),
  AWS: require('aws-sdk'),
  child_process: require('child_process'),
  crypto: require('crypto'),
  debug: require('debug')('pitsa'),
  fs: require('fs'),
  GitHubApi: require("github"),
  path: require('path'),
  tar: require('tar'),
  sizeOf: require('image-size'),
  request: require('request'),
  rmdir: require('rimraf'),
  skip: {},


  TEMPLATE: function(cb) {
    pitsa.debug('Reading HTML template.');
    pitsa.fs.readFile(
      pitsa.path.join(__dirname, '../lib/verify_template.html'),
      cb
    );
  },

  // Helpers start //
  last: function (array) {
    pitsa.debug('Give last item of array: %s', array);
    return array[array.length - 1];
  },

  exists: function (path, cb) {
    pitsa.fs.open(path, 'r', function (err, fd) {
      if (err) {
        pitsa.debug('File does not exist: %s', path);
        cb(err);
      } else {
        pitsa.debug('File does exist. %s', path);
        pitsa.fs.close(fd, cb);
      }
    });
  },

  max: function(first, second) {
    pitsa.debug('Return maximum of %s and %s', first, second);
    if (second > first) {
      return second;
    }
    return first;
  },

  addPostfix: function(filename, postfix) {
    pitsa.debug('Add postfix "%s" to file "%s".', postfix, filename);
    var fileparts = filename.split('.');
    var ext = fileparts.pop();
    var last_part = fileparts.pop();
    last_part += last_part + postfix;
    fileparts.push(last_part);
    fileparts.push(ext);
    var path = fileparts.join('.');
    pitsa.debug('Postfixed file %s', path);
    return path;
  },
  // Helpers end //

  env: function (name) {
    var value;
    pitsa.debug('Searching enviroment variable: %s', name);
    if (process.env[name] !== undefined) {
      value = process.env[name];
      pitsa.debug('Variable found: %s', value);
      return value;
    }
    pitsa.debug('Variable not found, fallback to default value.');
    value = pitsa.defaultValue(name);
    pitsa.debug('Default value: %s', value);
    return value;
  },

  defaultValue: function (name) {
    switch (name) {
    case 'SCREENSHOT_DIR':
      return 'screenshots';
    case 'PULL_REQUEST_URL':
      return process.env.CI_PULL_REQUEST;
    case 'PULL_REQUEST_NUMBER':
      return process.env.TRAVIS_PULL_REQUEST;
    case 'PROJECT_USERNAME':
      return pitsa.env('CIRCLE_PROJECT_USERNAME');
    case 'PROJECT_REPONAME':
      return pitsa.env('CIRCLE_PROJECT_REPONAME');
    case 'DEBUG':
      return false;
    case 'GITHUB_API_HOST':
      return 'api.github.com';
    case 'TEMP_SCREENSHOT_DIR':
      return 'screenshots_tmp';
    case 'WORKING_DIR':
      return '.';
    case 'OLD_SCREENSHOT_DIR':
      return 'old_screenshots';
    case 'TAG_NAME':
      return 'pitsa/guard';
    case 'PENDING_MESSAGE':
      return 'Please fix the screenshot changes.';
    case 'ALLOW_MESSAGE':
      return 'Screenshot changes are approved.';
    case 'DENY_MESSAGE':
      return 'Please fix the screenshot changes.';
    case 'COMMIT_HASH':
      return pitsa.env('CIRCLE_SHA1');
    case 'VERIFY_FILE':
      return pitsa.path.join(pitsa.env('SCREENSHOT_DIFF_DIR'), 'VERIFY.html');
    case 'SCREENSHOT_DIFF_DIR':
      return 'screenshot_diffs';
    case 'PITSA_SERVER_URL':
      return 'https://pitsa.herokuapp.com/';
    default:
      throw new Error('Enviroment variable "' + name + '" is not defined.');
    }
  },

  github: function() {
    pitsa.debug('Retrieving GitHub API.');
    if (pitsa._github === undefined) {
      pitsa.debug('GitHub API not created. Creating...');
      var github = new pitsa.GitHubApi({
        version: "3.0.0",
        debug: pitsa.env('DEBUG'),
        protocol: 'https',
        host: pitsa.env('GITHUB_API_HOST'),
        timeout: 5000,
        headers: {
          "user-agent": "Pitsa"
        }
      });
      github.authenticate({
        type: "oauth",
        token: pitsa.env('GITHUB_OAUTH_TOKEN')
      });
      pitsa._github = github;
      pitsa.debug('GitHub API created.');
    }
    return pitsa._github;
  },

  getPullRequestNumber: function (cb) {
    var repo_url, pr_number;
    pitsa.debug('Downloading previous screenshots.');
    repo_url = pitsa.env('PULL_REQUEST_URL');
    pitsa.debug('Pull request url: %s', repo_url);
    if (repo_url) {
      return cb(null, pitsa.last(repo_url.split('/')));
    }
    pr_number = pitsa.env('PULL_REQUEST_NUMBER');
    pitsa.debug('Pull request number: %s', pr_number);
    if (pr_number && pr_number !== 'false'){
      return cb(null, pr_number);
    }
    pitsa.debug('SKIP DOWNLOAD: Not a pull request');
    return cb(pitsa.skip);
  },

  fetchPR: function (pr_number, cb) {
    pitsa.debug('Fetching PR: %s', pr_number);
    return pitsa.github().pullRequests.get(
      {
        headers: {"user-agent": "Pitsa"},
        user: pitsa.env('PROJECT_USERNAME'),
        repo: pitsa.env('PROJECT_REPONAME'),
        number: pr_number
      },
      cb
    );
  },

  downloadPRFromS3: function (pull_request, cb) {
    pitsa.debug('Downloading from S3');
    var commit_hash = pull_request.base.sha;
    var s3 = new pitsa.AWS.S3();
    var params = {Bucket: pitsa.env('SCREENSHOT_BUCKET_NAME'), Key: commit_hash};
    return s3.getObject(
      params,
      cb
    );
  },

  extractScreenshots: function (data, cb) {
    pitsa.debug('Extracting screenshots.');
    pitsa.async.series(
      [
        pitsa.async.apply(
          pitsa.fs.rename,
          pitsa.env('SCREENSHOT_DIR'),
          pitsa.env('TEMP_SCREENSHOT_DIR')
        ),
        pitsa.async.apply(
          pitsa.extractTar,
          data
        ),
        pitsa.async.apply(
          pitsa.fs.rename,
          pitsa.env('SCREENSHOT_DIR'),
          pitsa.env('OLD_SCREENSHOT_DIR')
        ),
        pitsa.async.apply(
          pitsa.fs.rename,
          pitsa.env('TEMP_SCREENSHOT_DIR'),
          pitsa.env('SCREENSHOT_DIR')
        ),
        pitsa.async.apply(
          pitsa.rmdir,
          pitsa.env('SCREENSHOT_DIFF_DIR')
        )
      ],
      cb
    );
  },

  extractTar: function (data, cb) {
    pitsa.debug('Extracting tar.');
    var extrator = pitsa.tar.Extract({path: pitsa.env('WORKING_DIR')});
    extrator.write(data.Body);
    extrator.on('end', cb);
    extrator.end(function(){
      pitsa.debug('Extracting complete.');
    });
  },

  makeScreenshotDiffDirectory: function (values, cb) {
    pitsa.debug('Create directory for screenshot comparison results.');
    pitsa.fs.mkdir(
      pitsa.env('SCREENSHOT_DIFF_DIR'),
      cb
    );
  },

  readScreenshotDirectory: function () {
    var cb = arguments[arguments.length - 1];
    pitsa.debug('List screenshot directory contents');
    pitsa.fs.readdir(
      pitsa.env('SCREENSHOT_DIR'),
      cb
    );
  },

  doComparison: function (filenames, cb) {
    pitsa.debug('Compare screenshots');
    pitsa.async.each(filenames, pitsa.comparator, cb);
  },

  comparator: function (filename, cb) {
    pitsa.debug('Compare screenshot: %s', filename);
    if (pitsa.path.extname(filename) !== '.png') {
      pitsa.debug('Screenshot is not a PNG-image. Skipping...');
      return cb();
    }
    var old_filename = pitsa.path.join(pitsa.env('OLD_SCREENSHOT_DIR'), filename);
    pitsa.debug('Path to old image: %s', old_filename);
    var new_filename = pitsa.path.join(pitsa.env('SCREENSHOT_DIR'), filename);
    pitsa.debug('Path to new image: %s', new_filename);
    var diff_filename = pitsa.path.join(pitsa.env('SCREENSHOT_DIFF_DIR'), filename);
    pitsa.debug('Path to image diff: %s', diff_filename);
    var file_promise = pitsa.exists(old_filename, function(err){
      if (err){
        return pitsa.copyNewFileToDiff(new_filename, diff_filename, cb);
      }
      return pitsa.compareFile(old_filename, new_filename, diff_filename, cb);
    });
  },

  compareFile: function (old_filename, new_filename, diff_filename, cb) {
    return pitsa.resizeFiles(old_filename, new_filename, function(err, object){
      if (err){
        return cb(err);
      }
      var old_filename = object.old_filename;
      var new_filename = object.new_filename;
      pitsa.debug('Start comparison process for images: %s %s', old_filename, new_filename);
      var compare = pitsa.child_process.spawn(
        'compare',
        ['-metric', 'PSNR', new_filename, old_filename, diff_filename],
        {stdio: ['ignore', 'ignore', 'pipe']}
      );
      var stderr = '';
      compare.stderr.on('data', function (data) {
        stderr += data;
      });
      compare.on('close', function () {
        pitsa.debug('Comparison process finished for images: %s %s', old_filename, new_filename);
        if (stderr === 'inf\n') {
          pitsa.debug('Images were identical.');
          return pitsa.fs.unlink(diff_filename, function () {
            pitsa.debug('Removed comparison image: %s', diff_filename);
            return cb();
          });
        } else if (isNaN(new Number(stderr))) {
          throw new Error(stderr);
        } else {
          pitsa.debug('Images had differences.');
          return cb();
        }
      });
    });
  },

  resizeFiles: function (old_filename, new_filename, cb) {
    pitsa.debug('Find dimensions of images.');
    var old_dimensions = pitsa.sizeOf(old_filename);
    pitsa.debug('Old image dimensions:', old_dimensions);
    var new_dimensions = pitsa.sizeOf(new_filename);
    pitsa.debug('New image dimensions:', new_dimensions);
    var max_width = pitsa.max(old_dimensions.width, new_dimensions.width);
    var max_height = pitsa.max(old_dimensions.height, new_dimensions.height);
    return pitsa.async.parallel({
      new_filename: pitsa.async.apply(pitsa.resizeFile, old_filename, old_dimensions, max_width, max_height),
      old_filename: pitsa.async.apply(pitsa.resizeFile, new_filename, new_dimensions, max_width, max_height)
    }, cb);
  },

  resizeFile: function (filename, dimensions, max_width, max_height, cb) {
    pitsa.debug('Resizing', filename);
    if (dimensions.width === max_width && dimensions.height == max_height) {
      pitsa.debug('Image is of right size. Skipping...');
      cb(null, filename);
    } else {
      var converted_filename = pitsa.addPostfix(filename, '_resized');
      pitsa.debug('Start resize process.');
      var resize = pitsa.child_process.spawn(
        'convert',
        [filename, '-extent', max_width + 'x' + max_height, converted_filename],
        {stdio: ['ignore', 'ignore', process.stderr]}
      );
      resize.on('close', function(){
        pitsa.debug('Resized image:', converted_filename);
        return cb(null, converted_filename);
      });
    }
  },

  copyNewFileToDiff: function (new_filename, diff_filename, cb) {
    pitsa.debug('Old image not found. Copying the new one as such.');
    pitsa.fs.rename(
      new_filename,
      diff_filename,
      cb
    );
  },

  createTag: function (cb) {
    pitsa.fs.readdir(pitsa.env('SCREENSHOT_DIFF_DIR'), function(err, files){
      if(err){
        return cb(err);
      }
      if(files.length === 0){
        pitsa.debug('Screenshots have no changes.');
        return cb(pitsa.skip);
      }
      pitsa.debug('Create pending GitHub status.');
      return pitsa.github().statuses.create(
        {
          headers: {"user-agent": "Pitsa"},
          user: pitsa.env('PROJECT_USERNAME'),
          repo: pitsa.env('PROJECT_REPONAME'),
          sha: pitsa.env('COMMIT_HASH'),
          state: 'pending',
          description: pitsa.env('PENDING_MESSAGE'),
          context: pitsa.env('TAG_NAME'),
        },
        cb
      );
    });
  },

  readScreenshotDiffDirectory: function () {
    pitsa.debug('Read screenshot comparison directory.');
    var cb = arguments[arguments.length - 1];
    pitsa.fs.readdir(
      pitsa.env('SCREENSHOT_DIFF_DIR'),
      cb
    );
  },


  createTemplateAndImageTags: function (filenames, cb) {
    pitsa.debug('Fetch template and image tags.');
    return pitsa.async.parallel(
      {
        template: pitsa.TEMPLATE,
        image_tags: pitsa.async.apply(pitsa.createImageTags, filenames)
      }, cb
    );
  },

  createImageTags: function (filenames, cb) {
    pitsa.debug('Create image tags from filenames:', filenames);
    var images = [];
    filenames.forEach(function (file) {
      if (pitsa.path.extname(file) === '.png') {
        images.push(file + '<br>\n<img src="' + file + '", alt="' + file + '">');
      }
    });
    pitsa.debug('Image tags created.');
    return cb(null, images.join('\n<hr>\n'));
  },

  parseTemplate: function (object, cb) {
    var template = object.template;
    var image_tags = object.image_tags;
    var time_now = new Date().getTime();
    var github_parameters = {
      github_token: pitsa.env('GITHUB_OAUTH_TOKEN'),
      commit_hash: pitsa.env('COMMIT_HASH'),
      repository: pitsa.env('PROJECT_REPONAME'),
      owner: pitsa.env('PROJECT_USERNAME'),
      allow_description: pitsa.env('ALLOW_MESSAGE'),
      deny_description: pitsa.env('DENY_MESSAGE')
    };
    pitsa.debug('Send GitHub parameters to Pitsa server');
    pitsa.request({
      url: pitsa.env('PITSA_SERVER_URL') + 'register',
      method: 'POST',
      json: true,
      headers: {
          'content-type': 'application/json',
      },
      body: github_parameters
    }, function(error, response, body){
      pitsa.debug('Received a response from Pitsa server.');
      if (error){
        pitsa.debug('Request errored:', error);
        return cb(error);
      } else if (response.statusCode !== 200){
        pitsa.debug('Request has wrong response code: %s', response.statusCode);
        return cb(new Error('Registering GitHub parameters failed.'));
      }
      var signature = body.signature;
      pitsa.debug('Got signature:', signature);
      var allow_url = pitsa.env('PITSA_SERVER_URL') + signature + '/allow';
      var deny_url = pitsa.env('PITSA_SERVER_URL') + signature + '/deny';
      template = String(template)
        .replace('{{images}}', image_tags)
        .replace('{{allow_url}}', allow_url)
        .replace('{{deny_url}}', deny_url);
      return cb(null, template);
    });
  },

  writeToVerifyHtml: function (template, cb) {
    pitsa.debug('Write verify html to file.');
    return pitsa.fs.open(pitsa.env('VERIFY_FILE'), 'w', function(err, fd){
      if(err){
        pitsa.debug('Opening verify html failed.');
        return cb(err);
      }
      pitsa.fs.write(fd, new Buffer(template), 0, new Buffer(template).length, 0, function(err){
        if (err){
          pitsa.debug('Writing to verify html failed.');
          return cb(err);
        }
        pitsa.fs.close(fd, function(err){
          if (err){
            pitsa.debug('Closing verify html failed.');
            return cb(err);
          } else {
            pitsa.debug('Verify html writen.');
            return cb();
          }
        });
      });
    });
  },

  endSkip: function (err, cb) {
    if (err === pitsa.skip){
      pitsa.debug('Ending skip.');
      return cb();
    }
    if(!err){
      pitsa.debug('No error.');
      return cb();
    }
    pitsa.debug('Rethrow error.');
    return cb(err);
  },

  uploadScreenshots: function (cb) {
    pitsa.debug('Create tar from screenshots.');
    var archive = pitsa.archiver.create('tar');
    archive.directory(pitsa.env('SCREENSHOT_DIR'));
    archive.directory(pitsa.env('SCREENSHOT_DIFF_DIR'));
    archive.finalize();
    pitsa.debug('Upload screenshots tar.');
    var s3 = new pitsa.AWS.S3();
    var params = {Bucket: pitsa.env('SCREENSHOT_BUCKET_NAME'), Key: pitsa.env('COMMIT_HASH'), Body: archive};
    return s3.upload(params, cb);
  }
};


if (require.main === module) {
  pitsa.async.waterfall(
    [
      pitsa.getPullRequestNumber,
      pitsa.fetchPR,
      pitsa.downloadPRFromS3,
      pitsa.extractScreenshots,
      pitsa.makeScreenshotDiffDirectory,
      pitsa.readScreenshotDirectory,
      pitsa.doComparison,
      pitsa.createTag,
      pitsa.readScreenshotDiffDirectory,
      pitsa.createTemplateAndImageTags,
      pitsa.parseTemplate,
      pitsa.writeToVerifyHtml
    ],
    function(err){
      return pitsa.async.series([pitsa.async.apply(pitsa.endSkip, err), pitsa.uploadScreenshots], function(err){
        if (err){
          throw err;
        }
      });
    }
  );
}
