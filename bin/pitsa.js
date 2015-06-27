#!/usr/bin/env node
var pitsa = module.exports = {
  async: require('async'),
  archiver: require('archiver'),
  AWS: require('aws-sdk'),
  child_process: require('child_process'),
  crypto: require('crypto'),
  debug_main: require('debug')('pitsa:main'),
  debug_helper: require('debug')('pitsa:helper'),
  fs: require('fs'),
  GitHubApi: require("github"),
  path: require('path'),
  tar: require('tar'),
  sizeOf: require('image-size'),
  request: require('request'),
  rmdir: require('rimraf'),
  skip: {name: 'skip'},


  TEMPLATE: function TEMPLATE (cb) {
    pitsa.debug_helper('Reading HTML template.');
    pitsa.fs.readFile(
      pitsa.path.join(__dirname, '../lib/verify_template.html'),
      cb
    );
  },

  // Helpers start //
  last: function last (array) {
    pitsa.debug_helper('Give last item of array: %s', array);
    return array[array.length - 1];
  },

  exists: function exists (path, cb) {
    pitsa.fs.open(path, 'r', function exists_callback (err, fd) {
      if (err) {
        pitsa.debug_helper('File does not exist: %s', path);
        cb(err);
      } else {
        pitsa.debug_helper('File does exist. %s', path);
        pitsa.fs.close(fd, cb);
      }
    });
  },

  max: function max (first, second) {
    pitsa.debug_helper('Return maximum of %s and %s', first, second);
    if (second > first) {
      return second;
    }
    return first;
  },

  addPostfix: function addPostfix (filename, postfix) {
    pitsa.debug_helper('Add postfix "%s" to file "%s".', postfix, filename);
    var fileparts = filename.split(/([^:\\/]*?)(?:\.([^ :\\/.]*))?$/);
    fileparts.pop();
    var ext = fileparts.pop();
    var last_part = fileparts.pop();
    last_part += postfix;
    fileparts.push(last_part);
    if(ext){
      fileparts.push('.' + ext);
    }
    var path = fileparts.join('');
    pitsa.debug_helper('Postfixed file %s', path);
    return path;
  },

  env: function env (name) {
    var value;
    pitsa.debug_helper('Searching enviroment variable: %s', name);
    if (process.env[name] !== undefined) {
      value = process.env[name];
      pitsa.debug_helper('Variable found: %s', value);
      return value;
    }
    pitsa.debug_helper('Variable not found, fallback to default value.');
    value = pitsa.defaultValue(name);
    pitsa.debug_helper('Default value: %s', value);
    return value;
  },

  functionize: function functionize(value) {
    return function returnValue(){
      return value;
    };
  },

  defaultValue: function defaultValue (name) {
    CHOICES = {
      SCREENSHOT_DIR: pitsa.functionize('screenshots'),
      PULL_REQUEST_URL: pitsa.functionize(process.env.CI_PULL_REQUEST),
      PULL_REQUEST_NUMBER: pitsa.functionize(process.env.TRAVIS_PULL_REQUEST),
      PROJECT_USERNAME: function PROJECT_USERNAME() {
        return pitsa.env('CIRCLE_PROJECT_USERNAME');
      },
      PROJECT_REPONAME: function PROJECT_REPONAME() {
        return pitsa.functionize(pitsa.env('CIRCLE_PROJECT_REPONAME'));
      },
      DEBUG: pitsa.functionize(false),
      GITHUB_API_HOST: pitsa.functionize('api.github.com'),
      TEMP_SCREENSHOT_DIR: pitsa.functionize('screenshots_tmp'),
      WORKING_DIR: pitsa.functionize('.'),
      OLD_SCREENSHOT_DIR: pitsa.functionize('old_screenshots'),
      TAG_NAME: pitsa.functionize('pitsa/guard'),
      PENDING_MESSAGE: pitsa.functionize('Please fix the screenshot changes.'),
      ALLOW_MESSAGE: pitsa.functionize('Screenshot changes are approved.'),
      DENY_MESSAGE: pitsa.functionize('Please fix the screenshot changes.'),
      COMMIT_HASH: function COMMIT_HASH () {
        return pitsa.env('CIRCLE_SHA1');
      },
      VERIFY_FILE: function VERIFY_FILE() {
        return pitsa.path.join(pitsa.env('SCREENSHOT_DIFF_DIR'), 'VERIFY.html');
      },
      SCREENSHOT_DIFF_DIR: pitsa.functionize('screenshot_diffs'),
      PITSA_SERVER_URL: pitsa.functionize('https://pitsa.herokuapp.com/'),
    };
    var choice = CHOICES[name];
    if (choice === undefined) {
      throw new Error('Enviroment variable "' + name + '" is not defined.');
    }
    return choice();
  },

  github: function github () {
    pitsa.debug_helper('Retrieving GitHub API.');
    if (pitsa._github === undefined) {
      pitsa.debug_helper('GitHub API not created. Creating...');
      var github_api = new pitsa.GitHubApi({
        version: "3.0.0",
        debug: pitsa.env('DEBUG'),
        protocol: 'https',
        host: pitsa.env('GITHUB_API_HOST'),
        timeout: 5000,
        headers: {
          "user-agent": "Pitsa"
        }
      });
      github_api.authenticate({
        type: "oauth",
        token: pitsa.env('GITHUB_OAUTH_TOKEN')
      });
      pitsa._github = github_api;
      pitsa.debug_helper('GitHub API created.');
    }
    return pitsa._github;
  },
  // Helpers end //

  getPullRequestNumber: function getPullRequestNumber (cb) {
    var repo_url, pr_number;
    pitsa.debug_main('Downloading previous screenshots.');
    repo_url = pitsa.env('PULL_REQUEST_URL');
    pitsa.debug_main('Pull request url: %s', repo_url);
    if (repo_url) {
      return cb(null, pitsa.last(repo_url.split('/')));
    }
    pr_number = pitsa.env('PULL_REQUEST_NUMBER');
    pitsa.debug_main('Pull request number: %s', pr_number);
    if (pr_number && pr_number !== 'false'){
      return cb(null, pr_number);
    }
    pitsa.debug_main('SKIP DOWNLOAD: Not a pull request');
    return cb(pitsa.skip);
  },

  fetchPR: function fetchPR (pr_number, cb) {
    pitsa.debug_main('Fetching PR: %s', pr_number);
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

  downloadPRFromS3: function downloadPRFromS3 (pull_request, cb) {
    pitsa.debug_main('Downloading from S3');
    var commit_hash = pull_request.base.sha;
    var s3 = new pitsa.AWS.S3();
    var params = {Bucket: pitsa.env('SCREENSHOT_BUCKET_NAME'), Key: commit_hash};
    return s3.getObject(
      params,
      cb
    );
  },

  extractScreenshots: function extractScreenshots (data, cb) {
    pitsa.debug_main('Extracting screenshots.');
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

  extractTar: function extractTar (data, cb) {
    pitsa.debug_main('Extracting tar.');
    var extrator = pitsa.tar.Extract({path: pitsa.env('WORKING_DIR')});
    extrator.write(data.Body);
    extrator.on('end', cb);
    extrator.end(function extrator_callback (){
      pitsa.debug_main('Extracting complete.');
    });
  },

  makeScreenshotDiffDirectory: function makeScreenshotDiffDirectory () {
    var cb = arguments[arguments.length - 1];
    pitsa.debug_main('Create directory for screenshot comparison results.');
    pitsa.fs.mkdir(
      pitsa.env('SCREENSHOT_DIFF_DIR'),
      cb
    );
  },

  readScreenshotDirectory: function readScreenshotDirectory () {
    var cb = arguments[arguments.length - 1];
    pitsa.debug_main('List screenshot directory contents');
    pitsa.fs.readdir(
      pitsa.env('SCREENSHOT_DIR'),
      cb
    );
  },

  doComparison: function doComparison (filenames, cb) {
    pitsa.debug_main('Compare screenshots');
    pitsa.async.each(filenames, pitsa.comparator, cb);
  },

  comparator: function comparator (filename, cb) {
    pitsa.debug_main('Compare screenshot: %s', filename);
    if (pitsa.path.extname(filename) !== '.png') {
      pitsa.debug_main('Screenshot is not a PNG-image. Skipping...');
      return cb();
    }
    var old_filename = pitsa.path.join(pitsa.env('OLD_SCREENSHOT_DIR'), filename);
    pitsa.debug_main('Path to old image: %s', old_filename);
    var new_filename = pitsa.path.join(pitsa.env('SCREENSHOT_DIR'), filename);
    pitsa.debug_main('Path to new image: %s', new_filename);
    var diff_filename = pitsa.path.join(pitsa.env('SCREENSHOT_DIFF_DIR'), filename);
    pitsa.debug_main('Path to image diff: %s', diff_filename);
    return pitsa.exists(old_filename, function comparator_callback (err){
      if (err){
        return pitsa.copyNewFileToDiff(new_filename, diff_filename, cb);
      }
      return pitsa.compareFile(old_filename, new_filename, diff_filename, cb);
    });
  },

  compareFile: function compareFile (old_filename, new_filename, diff_filename, cb) {
    return pitsa.resizeFiles(old_filename, new_filename, function compare_file_callback (err, object){
      if (err){
        return cb(err);
      }
      var old_filename = object.old_filename;
      var new_filename = object.new_filename;
      pitsa.debug_main('Start comparison process for images: %s %s', old_filename, new_filename);
      var compare = pitsa.child_process.spawn(
        'compare',
        ['-metric', 'PSNR', new_filename, old_filename, diff_filename],
        {stdio: ['ignore', 'ignore', 'pipe']}
      );
      var stderr = '';
      compare.stderr.on('data', function compare_on_data (data) {
        stderr += data;
      });
      compare.on('close', function compare_on_close () {
        pitsa.debug_main('Comparison process finished for images: %s %s', old_filename, new_filename);
        if (stderr === 'inf\n') {
          pitsa.debug_main('Images were identical.');
          return pitsa.fs.unlink(diff_filename, function compare_unlink_file () {
            pitsa.debug_main('Removed comparison image: %s', diff_filename);
            return cb();
          });
        } else if (isNaN(stderr)) {
          throw new Error(stderr);
        } else {
          pitsa.debug_main('Images had differences.');
          return cb();
        }
      });
    });
  },

  resizeFiles: function resizeFiles (old_filename, new_filename, cb) {
    pitsa.debug_main('Find dimensions of images.');
    var old_dimensions = pitsa.sizeOf(old_filename);
    pitsa.debug_main('Old image dimensions: %s', old_dimensions);
    var new_dimensions = pitsa.sizeOf(new_filename);
    pitsa.debug_main('New image dimensions: %s', new_dimensions);
    var max_dimensions = {
      width: pitsa.max(old_dimensions.width, new_dimensions.width),
      height: pitsa.max(old_dimensions.height, new_dimensions.height)
    };
    return pitsa.async.parallel({
      new_filename: pitsa.async.apply(pitsa.resizeFile, new_filename, new_dimensions, max_dimensions),
      old_filename: pitsa.async.apply(pitsa.resizeFile, old_filename, old_dimensions, max_dimensions)
    }, cb);
  },

  resizeFile: function resizeFile (filename, dimensions, max_dimensions, cb) {
    pitsa.debug_main('Resizing "%s"', filename);
    if (dimensions.width === max_dimensions.width && dimensions.height == max_dimensions.height) {
      pitsa.debug_main('Image is of right size. Skipping...');
      cb(null, filename);
    } else {
      var converted_filename = pitsa.addPostfix(filename, '_resized');
      pitsa.debug_main('Start resize process.');
      var resize = pitsa.child_process.spawn(
        'convert',
        [filename, '-extent', max_dimensions.width + 'x' + max_dimensions.height, converted_filename],
        {stdio: ['ignore', 'ignore', process.stderr]}
      );
      resize.on('close', function resize_on_close () {
        pitsa.debug_main('Resized image:', converted_filename);
        return cb(null, converted_filename);
      });
    }
  },

  copyNewFileToDiff: function copyNewFileToDiff (new_filename, diff_filename, cb) {
    pitsa.debug_main('Old image not found. Copying the new one as such.');
    pitsa.fs.rename(
      new_filename,
      diff_filename,
      cb
    );
  },

  createTag: function createTag (cb) {
    pitsa.fs.readdir(pitsa.env('SCREENSHOT_DIFF_DIR'), function create_tag_callback (err, files){
      if(err){
        return cb(err);
      }
      if(files.length === 0){
        pitsa.debug_main('Screenshots have no changes.');
        return cb(pitsa.skip);
      }
      pitsa.debug_main('Create pending GitHub status.');
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

  readScreenshotDiffDirectory: function readScreenshotDiffDirectory () {
    pitsa.debug_main('Read screenshot comparison directory.');
    var cb = arguments[arguments.length - 1];
    pitsa.fs.readdir(
      pitsa.env('SCREENSHOT_DIFF_DIR'),
      cb
    );
  },


  createTemplateAndImageTags: function createTemplateAndImageTags (filenames, cb) {
    pitsa.debug_main('Fetch template and image tags.');
    return pitsa.async.parallel(
      {
        template: pitsa.TEMPLATE,
        image_tags: pitsa.async.apply(pitsa.createImageTags, filenames)
      }, cb
    );
  },

  createImageTags: function createImageTags (filenames, cb) {
    pitsa.debug_main('Create image tags from filenames: %s', filenames);
    var images = [];
    filenames.forEach(function create_image_tag (file) {
      if (pitsa.path.extname(file) === '.png') {
        images.push(file + '<br>\n<img src="' + file + '", alt="' + file + '">');
      }
    });
    pitsa.debug_main('Image tags created.');
    return cb(null, images.join('\n<hr>\n'));
  },

  parseTemplate: function parseTemplate (object, cb) {
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
    pitsa.debug_main('Send GitHub parameters to Pitsa server');
    pitsa.request({
      url: pitsa.env('PITSA_SERVER_URL') + 'register',
      method: 'POST',
      json: true,
      headers: {
          'content-type': 'application/json',
      },
      body: github_parameters
    }, function pitsa_server_request_callback (error, response, body) {
      pitsa.debug_main('Received a response from Pitsa server.');
      if (error){
        pitsa.debug_main('Request errored: %s', error);
        return cb(error);
      } else if (response.statusCode !== 200){
        pitsa.debug_main('Request has wrong response code: %s', response.statusCode);
        return cb(new Error('Registering GitHub parameters failed.'));
      }
      var signature = body.signature;
      pitsa.debug_main('Got signature: %s', signature);
      var allow_url = pitsa.env('PITSA_SERVER_URL') + signature + '/allow';
      var deny_url = pitsa.env('PITSA_SERVER_URL') + signature + '/deny';
      template = String(template)
        .replace('{{images}}', image_tags)
        .replace('{{allow_url}}', allow_url)
        .replace('{{deny_url}}', deny_url);
      return cb(null, template);
    });
  },

  writeToVerifyHtml: function writeToVerifyHtml (template, cb) {
    pitsa.debug_main('Write verify html to file.');
    return pitsa.fs.open(pitsa.env('VERIFY_FILE'), 'w', function write_verify_html_callback (err, fd){
      if(err){
        pitsa.debug_main('Opening verify html failed.');
        return cb(err);
      }
      pitsa.fs.write(fd, new Buffer(template), 0, new Buffer(template).length, 0, function(err){
        if (err){
          pitsa.debug_main('Writing to verify html failed.');
          return cb(err);
        }
        pitsa.fs.close(fd, function write_verify_html_close_file (err){
          if (err){
            pitsa.debug_main('Closing verify html failed.');
            return cb(err);
          } else {
            pitsa.debug_main('Verify html writen.');
            return cb();
          }
        });
      });
    });
  },

  endSkip: function endSkip (err, cb) {
    if (err === pitsa.skip){
      pitsa.debug_main('Ending skip.');
      return cb();
    }
    if(!err){
      pitsa.debug_main('No error.');
      return cb();
    }
    pitsa.debug_main('Rethrow error.');
    return cb(err);
  },

  uploadScreenshots: function uploadScreenshots (cb) {
    pitsa.debug_main('Create tar from screenshots.');
    var archive = pitsa.archiver.create('tar');
    archive.directory(pitsa.env('SCREENSHOT_DIR'));
    archive.directory(pitsa.env('SCREENSHOT_DIFF_DIR'));
    archive.finalize();
    pitsa.debug_main('Upload screenshots tar.');
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
    function second_execution_stage (err){
      return pitsa.async.series([pitsa.async.apply(pitsa.endSkip, err), pitsa.uploadScreenshots], function rethrow_error (err){
        if (err){
          throw err;
        }
      });
    }
  );
}
