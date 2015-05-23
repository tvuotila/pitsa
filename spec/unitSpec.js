var rerequire = function (module) {
    try {
      delete require.cache[require.resolve(module)];
    } catch(err) {}
    return require(module);
};

describe('Pitsa', function(){
  var pitsa;
  beforeEach(function(){
    pitsa = rerequire('../bin/pitsa.js');
  });
  it('should be defined', function(){
    expect(pitsa).toBeDefined();
  });
  describe('TEMPLATE', function(){
    it('should be defined', function(){
      expect(pitsa.TEMPLATE).toBeDefined();
    });
    it('should return html to callback', function(done){
      pitsa.TEMPLATE(
        function(err, value){
          expect(err).toBe(null);
          expect(value).toEqual(jasmine.stringMatching(/<html>/));
          return done();
        }
      );
    });
  });
  describe('helpers', function(){
    describe('last', function(){
      it('should be defined', function(){
        expect(pitsa.last).toBeDefined();
      });
      it('should return undefined for empty array', function(){
        expect(pitsa.last([])).toBeUndefined();
      });
      it('should return last value for array of size one', function(){
        var value = {name: 'last value'};
        expect(pitsa.last([value])).toBe(value);
      });
      it('should return last value for array of size two', function(){
        var value = {name: 'last value'};
        expect(pitsa.last([1, value])).toBe(value);
      });
      it('should return last value for array of large size', function(){
        var value = {name: 'last value'};
        var array = [];
        for (var i = 1; i <= 123; i++) {
           array.push(i);
        }
        array.push(value);
        expect(pitsa.last(array)).toBe(value);
      });
    });
    describe('exists', function(){
      var fileMock;
      beforeEach(function(){
        fileMock = {name: 'fileMock'};
        pitsa.fs = {
          open: function(path, mode, cb){
            cb(undefined, fileMock);
          },
          close: function(fd, cb){
            cb();
          }
        };
        spyOn(pitsa.fs, 'open').and.callThrough();
        spyOn(pitsa.fs, 'close').and.callThrough();
      });
      it('should be defined', function(){
        expect(pitsa.exists).toBeDefined();
      });
      it('should call open with path', function(){
        var path = 'some path';
        pitsa.exists(path, function(){});
        expect(pitsa.fs.open).toHaveBeenCalledWith(path, 'r', jasmine.any(Function));
      });
      describe('successful case', function(){
        it('should call callback', function(done){
          var path = 'some path';
          pitsa.exists(path, function(err){
            expect(err).toBeFalsy();
            expect(pitsa.fs.close).toHaveBeenCalledWith(fileMock, jasmine.any(Function));
            done();
          });
        });
      });
      describe('failure case', function(){
        var errorMock;
        beforeEach(function(){
          errorMock = {name: 'error'};
          pitsa.fs.open = function FsOpenMock (path, mode, cb){
            cb(errorMock, undefined);
          };
        });
        it('should call callback with error', function(done){
          var path = 'some path';
          pitsa.exists(path, function(err){
            expect(err).toBe(errorMock);
            expect(pitsa.fs.close).not.toHaveBeenCalled();
            done();
          });
        });
      });
    });
    describe('max', function(){
      it('should be defined', function(){
        expect(pitsa.max).toBeDefined();
      });
      it('should return first for equal values', function(){
        var value1 = [1, 2];
        var value2 = [1, 2];
        expect(pitsa.max(value1, value2)).toBe(value1);
        expect(pitsa.max(value1, value2)).not.toBe(value2);
      });
      it('should return first if first larger', function(){
        expect(pitsa.max(2, 1)).toBe(2);
      });
      it('should return second if second larger', function(){
        expect(pitsa.max(2, 3)).toBe(3);
      });
    });
    describe('addPostfix', function(){
      it('should be defined', function(){
        expect(pitsa.addPostfix).toBeDefined();
      });
      it('should add postfix to relative path', function(){
        expect(pitsa.addPostfix('value.txt', '_postfix')).toBe('value_postfix.txt');
      });
      it('should add postfix to absolute path', function(){
        expect(pitsa.addPostfix('/usr/user/home/file.txt', '_postfix')).toBe('/usr/user/home/file_postfix.txt');
      });
      it('should add postfix to partial path', function(){
        expect(pitsa.addPostfix('../data/file.txt', '_old')).toBe('../data/file_old.txt');
      });
      it('should add postfix to a file without extension', function(){
        expect(pitsa.addPostfix('data/value', '_moved')).toBe('data/value_moved');
      });
    });
    describe('env', function(){
      beforeEach(function(){
        pitsa.defaultValue = function defaultValueMock (){
          return 'default_value';
        };
        spyOn(pitsa, 'defaultValue').and.callThrough();
      });
      it('should be defined', function(){
        expect(pitsa.env).toBeDefined();
      });
      it('should return value from enviroment variables', function(){
        var value;
        process.env.TEST_VALUE = value = 'SAVED_VALUE';
        expect(pitsa.env('TEST_VALUE')).toBe(value);
        expect(pitsa.defaultValue).not.toHaveBeenCalled();
      });
      it('should return default value if value is not in enviroment', function(){
        expect(pitsa.env('NON_EXISTING_KEY')).toBe('default_value');
        expect(pitsa.defaultValue).toHaveBeenCalledWith('NON_EXISTING_KEY');
      });
    });
    describe('defaultValue', function(){
      it('should be defined', function(){
        expect(pitsa.defaultValue).toBeDefined();
      });
      it('should return default tag name', function(){
        expect(pitsa.defaultValue('TAG_NAME')).toBe('pitsa/guard');
      });
      it('should return pull request url from enviroment', function(){
        var value;
        process.env.CI_PULL_REQUEST = value = 'SAVED_VALUE';
        expect(pitsa.defaultValue('PULL_REQUEST_URL')).toBe(value);
      });
      it('should call env with circle_sha1 when requesting commit_hash', function(){
        spyOn(pitsa, 'env').and.returnValue(123456);
        expect(pitsa.defaultValue('COMMIT_HASH')).toBe(123456);
        expect(pitsa.env).toHaveBeenCalledWith('CIRCLE_SHA1');
      });
      it('should throw error for unknown key', function(){
        expect(function() {
          pitsa.defaultValue('unknown');
        }).toThrowError('Enviroment variable "unknown" is not defined.');
      });
    });
    describe('github', function(){
      var githubMock;
      beforeEach(function(){
        githubMock = {authenticate: function(){}};
        pitsa.GitHubApi = function GitHubApiMock (){
          return githubMock;
        };
        pitsa.env = function envMock (key){
          return {
            DEBUG: true,
            GITHUB_API_HOST: 'www.host.com',
            GITHUB_OAUTH_TOKEN: 'token'
          }[key];
        };
      });
      it('should be defined', function(){
        expect(pitsa.github).toBeDefined();
      });
      it('should define _github', function(){
        expect(pitsa._github).toBeUndefined();
        pitsa.github();
        expect(pitsa._github).toBeDefined();
        expect(pitsa._github).toBe(githubMock);
      });
      it('should call modules with right values', function(){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(pitsa, 'GitHubApi').and.callThrough();
        spyOn(githubMock, 'authenticate').and.callThrough();
        expect(pitsa.github()).toBe(githubMock);
        expect(pitsa.env).toHaveBeenCalledWith('DEBUG');
        expect(pitsa.env).toHaveBeenCalledWith('GITHUB_API_HOST');
        expect(pitsa.env).toHaveBeenCalledWith('GITHUB_OAUTH_TOKEN');
        expect(pitsa.GitHubApi).toHaveBeenCalledWith({
          version: '3.0.0',
          debug: true,
          protocol: 'https',
          host: 'www.host.com',
          timeout: 5000,
          headers: {'user-agent': 'Pitsa'}
        });
        expect(githubMock.authenticate).toHaveBeenCalledWith({
          type: 'oauth',
          token: 'token'
        });
      });
    });
    describe('getPullRequestNumber', function(){
      beforeEach(function(){
        pitsa.env = function envMock (){};
        pitsa.last = function lastMock (){};
      });
      it('should be defined', function(){
        expect(pitsa.getPullRequestNumber).toBeDefined();
      });
      it('should call callback with pr_number if pull request url is defined', function(done){
        spyOn(pitsa, 'env').and.returnValue('https://www.something.something/pulls/123');
        spyOn(pitsa, 'last').and.returnValue('123');
        pitsa.getPullRequestNumber(function(err, pr_number){
          expect(err).toBeFalsy();
          expect(pr_number).toBe('123');
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_URL');
          expect(pitsa.last).toHaveBeenCalledWith(
            ['https:', '', 'www.something.something', 'pulls', '123']
          );
          done();
        });
      });
      it('should call callback with pr_number if pull request number is defined', function(done){
        spyOn(pitsa, 'env').and.callFake(function(key) {
          return {
            PULL_REQUEST_URL: undefined,
            PULL_REQUEST_NUMBER:'123'
          }[key];
        });
        spyOn(pitsa, 'last').and.callThrough();
        pitsa.getPullRequestNumber(function(err, pr_number){
          expect(err).toBeFalsy();
          expect(pr_number).toBe('123');
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_URL');
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_NUMBER');
          expect(pitsa.last).not.toHaveBeenCalled();
          done();
        });
      });
      it('should call callback with skip if pull request number is false', function(done){
        spyOn(pitsa, 'env').and.callFake(function(key) {
          return {
            PULL_REQUEST_URL: undefined,
            PULL_REQUEST_NUMBER:'false'
          }[key];
        });
        spyOn(pitsa, 'last').and.callThrough();
        pitsa.getPullRequestNumber(function(err, pr_number){
          expect(err).toBe(pitsa.skip);
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_URL');
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_NUMBER');
          expect(pitsa.last).not.toHaveBeenCalled();
          done();
        });
      });
      it('should reject if pull request url and number are undefined', function(done){
        spyOn(pitsa, 'env').and.callFake(function(key) {
          return {
            PULL_REQUEST_URL: undefined,
            PULL_REQUEST_NUMBER: undefined
          }[key];
        });
        spyOn(pitsa, 'last').and.callThrough();
        pitsa.getPullRequestNumber(function(err, pr_number){
          expect(err).toBe(pitsa.skip);
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_URL');
          expect(pitsa.env).toHaveBeenCalledWith('PULL_REQUEST_NUMBER');
          expect(pitsa.last).not.toHaveBeenCalled();
          done();
        });
      });
    });
    describe('fetchPR', function(){
      var _githubMock, resultMock;
      beforeEach(function(){
        resultMock = {name: 'result'};
        _githubMock = {
          pullRequests: {
            get: function(object, cb){
              return cb(null, resultMock);
            }
          }
        };
        pitsa.github = function githubMock (){
          return _githubMock;
        };
        pitsa.env = function envMock (key){
          return {
            PROJECT_USERNAME: 'guthub_user',
            PROJECT_REPONAME: 'github_repo'
          }[key];
        };
      });
      it('should be defined', function(){
        expect(pitsa.fetchPR).toBeDefined();
      });
      it('should call pullRequest.get of github', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(_githubMock.pullRequests, 'get').and.callThrough();
        pitsa.fetchPR('123', function(err, data){
          expect(err).toBeFalsy();
          expect(data).toBe(resultMock);
          expect(pitsa.env).toHaveBeenCalledWith('PROJECT_USERNAME');
          expect(pitsa.env).toHaveBeenCalledWith('PROJECT_REPONAME');
          expect(_githubMock.pullRequests.get).toHaveBeenCalledWith({
            headers: {'user-agent': 'Pitsa' },
            user: 'guthub_user',
            repo: 'github_repo',
            number: '123'
          }, jasmine.any(Function));
          done();
        });
      });
    });
    describe('downloadPRFromS3', function(){
      var pull_request, AWSMock, S3Mock, resultMock;
      beforeEach(function(){
        pitsa.env = function envMock (){};
        pull_request = {base: {sha: '123456789'}};
        resultMock = {name: 'result'};
        S3Mock = {
          getObject: function getObjectMock (data, cb) {
            return cb(null, resultMock);
          }
        };
        pitsa.AWS = {
          S3: function S3GetterMock (){
            return S3Mock;
          }
        };
        pitsa.env = envMock = function(){
          return 'screenshot-bucket';
        };
      });
      it('should be defined', function(){
        expect(pitsa.downloadPRFromS3).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(S3Mock, 'getObject').and.callThrough();
        pitsa.downloadPRFromS3(pull_request, function(err, data){
          expect(err).toBeFalsy();
          expect(data).toBe(resultMock);
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_BUCKET_NAME');
          expect(S3Mock.getObject).toHaveBeenCalledWith(
            {Bucket: 'screenshot-bucket', Key: '123456789'},
            jasmine.any(Function)
          );
          done();
        });
      });
    });
    describe('extractScreenshots', function(){
      var pull_request, resultMock, data;
      beforeEach(function(){
        data = {name: 'data'};
        pitsa.env = function envMock (key){
          return {
            SCREENSHOT_DIR: 'screenshot_dir',
            TEMP_SCREENSHOT_DIR: 'temp_screenshot_dir',
            OLD_SCREENSHOT_DIR: 'old_screenshot_dir',
            SCREENSHOT_DIFF_DIR: 'screenshot_diff_dir'
          }[key];
        };
        pitsa.fs = {
          rename: function(from, to, cb){
            return cb();
          }
        };
        pitsa.rmdir = function rmdirMock (what, cb){
          return cb();
        };
        pitsa.extractTar = function extractTarMock (data, cb){
          return cb();
        };
      });
      it('should be defined', function(){
        expect(pitsa.extractScreenshots).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(pitsa.fs, 'rename').and.callThrough();
        spyOn(pitsa, 'rmdir').and.callThrough();
        spyOn(pitsa, 'extractTar').and.callThrough();
        pitsa.extractScreenshots(data, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('TEMP_SCREENSHOT_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('OLD_SCREENSHOT_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('TEMP_SCREENSHOT_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIFF_DIR');
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIFF_DIR');
          expect(pitsa.fs.rename).toHaveBeenCalledWith(
            'screenshot_dir',
            'temp_screenshot_dir',
            jasmine.any(Function)
          );
          expect(pitsa.extractTar).toHaveBeenCalledWith(data, jasmine.any(Function));
          expect(pitsa.fs.rename).toHaveBeenCalledWith(
            'screenshot_dir',
            'old_screenshot_dir',
            jasmine.any(Function)
          );
          expect(pitsa.fs.rename).toHaveBeenCalledWith(
            'temp_screenshot_dir',
            'screenshot_dir',
            jasmine.any(Function)
          );
          expect(pitsa.rmdir).toHaveBeenCalledWith('screenshot_diff_dir', jasmine.any(Function));
          done();
        });
      });
    });
    describe('extractTar', function(){
      var data, writerMock;
      beforeEach(function(){
        pitsa.env = function envMock (key){
          return '.';
        };
        writerMock = {
          write: function(){
            return writerMock;
          },
          end: function(cb){
            cb();
            writerMock.endCallback();
            return writerMock;
          },
          on: function(name, cb){
            writerMock.endCallback = cb;
            return writerMock;
          }
        };
        pitsa.tar = {Extract: function(){
          return writerMock;
        }};
        data = {Body: {name: 'body'}};
      });
      it('should be defined', function(){
        expect(pitsa.extractTar).toBeDefined();
      });
      it('function should call modules with right values', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(writerMock, 'write').and.callThrough();
        pitsa.extractTar(data, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.env).toHaveBeenCalledWith('WORKING_DIR');
          expect(writerMock.write).toHaveBeenCalledWith(data.Body);
          done();
        });
      });
    });
    describe('makeScreenshotDiffDirectory', function(){
      beforeEach(function(){
        pitsa.env = function envMock (){
          return 'screenshot_diff_dir';
        };
        pitsa.fs = {
          mkdir: function(what, cb){
            return cb();
          }
        };
      });
      it('should be defined', function(){
        expect(pitsa.makeScreenshotDiffDirectory).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(pitsa.fs, 'mkdir').and.callThrough();
        pitsa.makeScreenshotDiffDirectory(null, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIFF_DIR');
          expect(pitsa.fs.mkdir).toHaveBeenCalledWith(
            'screenshot_diff_dir',
            jasmine.any(Function)
          );
          done();
        });
        
      });
    });
    describe('readScreenshotDirectory', function(){
      beforeEach(function(){
        pitsa.env = function envMock (){
          return 'screenshot_dir';
        };
        pitsa.fs = {
          readdir: function(what, cb){
            return cb();
          }
        };
      });
      it('should be defined', function(){
        expect(pitsa.readScreenshotDirectory).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(pitsa.fs, 'readdir').and.callThrough();
        pitsa.readScreenshotDirectory(function(err){
          expect(err).toBeFalsy();
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIR');
          expect(pitsa.fs.readdir).toHaveBeenCalledWith('screenshot_dir', jasmine.any(Function));
          done();
        });
      });
    });
    describe('doComparison', function(){
      var filelist;
      beforeEach(function(){
        filelist = [];
        pitsa.comparator = function comparatorMock (filename, cb){
          filelist.push(filename);
          return cb();
        };
      });
      it('should be defined', function(){
        expect(pitsa.doComparison).toBeDefined();
      });
      it('should call modules with right values', function(done){
        pitsa.doComparison(['1', '2'], function(err){
          expect(err).toBeFalsy();
          expect(filelist).toEqual([ '1', '2' ]);
          done();
        });
      });
    });
    describe('comparator', function(){
      var filename;
      beforeEach(function(){
        filename = 'image.png';
        pitsa.copyNewFileToDiff = function copyNewFileToDiffMock (new_filename, diff_filename, cb){
          return cb();
        };
        pitsa.compareFile = function compareFileMock (old_new, new_filename, diff_filename, cb){
          return cb();
        };
      });
      it('should be defined', function(){
        expect(pitsa.comparator).toBeDefined();
      });
      it('should call compareFile if file exists', function(done){
        spyOn(pitsa, 'exists').and.callFake(function(name_value, cb){
          return cb();
        });
        spyOn(pitsa, 'copyNewFileToDiff').and.callThrough();
        spyOn(pitsa, 'compareFile').and.callThrough();
        pitsa.comparator(filename, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.copyNewFileToDiff).not.toHaveBeenCalled();
          expect(pitsa.compareFile).toHaveBeenCalledWith(
            'old_screenshots/image.png',
            'screenshots/image.png',
            'screenshot_diffs/image.png',
            jasmine.any(Function)
          );
          done();
        });
      });
      it('should call copyNewFileToDiff if file doesen\'t exists', function(done){
        spyOn(pitsa, 'exists').and.callFake(function(name_value, cb){
          return cb(new Error('No such file'));
        });
        spyOn(pitsa, 'copyNewFileToDiff').and.callThrough();
        spyOn(pitsa, 'compareFile').and.callThrough();
        pitsa.comparator(filename, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.compareFile).not.toHaveBeenCalled();
          expect(pitsa.copyNewFileToDiff).toHaveBeenCalledWith(
            'screenshots/image.png',
            'screenshot_diffs/image.png',
            jasmine.any(Function)
          );
          done();
        });
      });
      it('should call nothing if file is not a png image', function(done){
        filename = 'not.a.image';
        spyOn(pitsa, 'exists').and.callThrough();
        spyOn(pitsa, 'copyNewFileToDiff').and.callThrough();
        spyOn(pitsa, 'compareFile').and.callThrough();
        pitsa.comparator(filename, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.compareFile).not.toHaveBeenCalled();
          expect(pitsa.copyNewFileToDiff).not.toHaveBeenCalled();
          expect(pitsa.exists).not.toHaveBeenCalled();
          done();
        });
      });
    });
    describe('compareFile', function(){
      var old_filename, new_filename,
          diff_filename, child_process;
      beforeEach(function(){
        pitsa.resizeFiles = function resizeFilesMock (old_filename, new_filename, cb) {
          return cb(
            null,
            {
              old_filename: old_filename,
              new_filename: new_filename
            }
          );
        };
        old_filename = 'old_file.png';
        new_filename = 'new_file.png';
        diff_filename = 'diff_file.png';
        child_process = {
          on: function(hook, cb) {
            cb();
          },
          stderr: {
            on: function(hook, cb) {
              cb('inf\n');
            }
          }
        };
        pitsa.child_process.spawn = function() {
          return child_process;
        };
      });
      it('should be defined', function(){
        expect(pitsa.compareFile).toBeDefined();
      });
      it('should call spawn with right arguments', function(done){
        spyOn(pitsa.child_process, 'spawn').and.callThrough();
        pitsa.compareFile(old_filename, new_filename, diff_filename, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.child_process.spawn).toHaveBeenCalledWith(
            'compare',
            ['-metric', 'PSNR', 'new_file.png', 'old_file.png', 'diff_file.png'],
            {stdio: ['ignore', 'ignore', 'pipe']}
          );
          done();
        });
      });
    });
    describe('resizeFiles', function(){
      var old_filename, new_filename;
      beforeEach(function(){
        old_filename = 'old_file.png';
        new_filename = 'new_file.png';
        pitsa.sizeOf = function sizeOfMock (filename) {
          return {width: 100, height: 100};
        };
        pitsa.resizeFile = function resizeFileMock (filename, dimensions, max_dimensions, cb){
          return cb(null, filename);
        };
      });
      it('should be defined', function(){
        expect(pitsa.resizeFiles).toBeDefined();
      });
      it('should call spawn with right arguments', function(done){
        spyOn(pitsa, 'sizeOf').and.callThrough();
        pitsa.resizeFiles(old_filename, new_filename, function(err, filenames){
          expect(err).toBeFalsy();
          expect(pitsa.sizeOf).toHaveBeenCalledWith(old_filename);
          expect(pitsa.sizeOf).toHaveBeenCalledWith(new_filename);
          expect(filenames).toEqual({
            old_filename: old_filename,
            new_filename: new_filename
          });
          done();
        });
      });
    });
    describe('resizeFile', function(){
      var filename, converted_filename, child_process, dimensions, max_dimensions;
      beforeEach(function(){
        filename = 'old_file.png';
        resized_filename = 'old_file_resized.png';
        dimensions = {width: 100, height: 100};
        max_dimensions = {width: 100, height: 100};
        child_process = {
          on: function(hook, cb) {
            cb();
          },
        };
        pitsa.child_process.spawn = function() {
          return child_process;
        };
      });
      it('should be defined', function(){
        expect(pitsa.resizeFile).toBeDefined();
      });
      it('should skip if dimensions are equal', function(done){
        spyOn(pitsa.child_process, 'spawn').and.callThrough();
        pitsa.resizeFile(filename, dimensions, max_dimensions, function(err, name_value){
          expect(err).toBeFalsy();
          expect(name_value).toEqual(filename);
          expect(pitsa.child_process.spawn).not.toHaveBeenCalled();
          done();
        });
      });
      it('should call convert if dimensions differ', function(done){
        max_dimensions = {width: 200, height: 300};
        spyOn(pitsa.child_process, 'spawn').and.callThrough();
        pitsa.resizeFile(filename, dimensions, max_dimensions, function(err, name_value){
          expect(err).toBeFalsy();
          expect(name_value).toEqual(resized_filename);
          expect(pitsa.child_process.spawn).toHaveBeenCalledWith(
            'convert',
            [
              filename,
              '-extent',
              '200x300',
              resized_filename
            ],
            {stdio: ['ignore', 'ignore', process.stderr]}
          );
          done();
        });
      });
    });
    describe('copyNewFileToDiff', function(){
      var callback, new_filename, diff_filename;
      beforeEach(function(){
        new_filename = 'new_file.png';
        diff_filename = 'diff_file.png';
        pitsa.fs = {
          rename: function(from, to, cb){
            return cb();
          }
        };
        callback = function(){};
      });
      it('should be defined', function(){
        expect(pitsa.copyNewFileToDiff).toBeDefined();
      });
      it('should call rename with filenames', function(){
        spyOn(pitsa.fs, 'rename').and.callThrough();
        pitsa.copyNewFileToDiff(
          new_filename,
          diff_filename,
          callback
        );
        expect(pitsa.fs.rename).toHaveBeenCalledWith(
          new_filename,
          diff_filename,
          callback
        );
      });
    });
    describe('createTag', function(){
      var files, githubMock;
      beforeEach(function(){
        pitsa.env = function envMock (key){
          return {
            SCREENSHOT_DIFF_DIR: 'screenshot_diffs_dir',
            PROJECT_USERNAME: 'fastmonkeys',
            PROJECT_REPONAME: 'pitsa',
            COMMIT_HASH: 'hashofcommit',
            PENDING_MESSAGE: 'message pending',
            TAG_NAME: 'name of tag',
          }[key];
        };
        pitsa.fs = {
          readdir: function(what, cb){
            return cb(null, files);
          }
        };
        githubMock = {
          statuses: {
            create: function(data, cb){
              return cb();
            }
          }
        };  
        pitsa.github = function(){
          return githubMock;
        };
      });
      it('should be defined', function(){
        expect(pitsa.createTag).toBeDefined();
      });
      describe('non empty directory', function(){
        beforeEach(function(){
          files = ['this', 'that'];
        });
        it('should call readdir with enviroment variable', function(){
          spyOn(pitsa.fs, 'readdir').and.callThrough();
          pitsa.createTag(function(err){
            expect(err).toBeFalsy();
            expect(pitsa.fs.readdir).toHaveBeenCalledWith(
              'screenshot_diffs_dir',
              jasmine.any(Function)
            );
          });
        });
        it('should call github statuses.create', function(){
          spyOn(githubMock.statuses, 'create').and.callThrough();
          pitsa.createTag(function(err){
            expect(err).toBeFalsy();
            expect(githubMock.statuses.create).toHaveBeenCalledWith(
              {
                headers: {'user-agent': 'Pitsa'},
                user: 'fastmonkeys',
                repo: 'pitsa',
                sha: 'hashofcommit',
                state: 'pending',
                description: 'message pending',
                context: 'name of tag'
              },
              jasmine.any(Function)
            );
          });
        });
      });
      describe('empty directory', function(){
        beforeEach(function(){
          files = [];
        });
        it('should call readdir with enviroment variable', function(){
          spyOn(pitsa.fs, 'readdir').and.callThrough();
          pitsa.createTag(function(err){
            expect(pitsa.fs.readdir).toHaveBeenCalledWith(
              'screenshot_diffs_dir',
              jasmine.any(Function)
            );
          });
        });
        it('should not call github statuses.create', function(){
          spyOn(githubMock.statuses, 'create').and.callThrough();
          pitsa.createTag(function(err){
            expect(githubMock.statuses.create).not.toHaveBeenCalled();
          });
        });
        it('should skip', function(){
          pitsa.createTag(function(err){
            expect(err).toBe(pitsa.skip);
          });
        });
      });
    });
    describe('readScreenshotDiffDirectory', function(){
      beforeEach(function(){
        pitsa.env = function envMock (){
          return 'screenshot_diff_dir';
        };
        pitsa.fs = {
          readdir: function(what, cb){
            return cb();
          }
        };
      });
      it('should be defined', function(){
        expect(pitsa.readScreenshotDiffDirectory).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'env').and.callThrough();
        spyOn(pitsa.fs, 'readdir').and.callThrough();
        pitsa.readScreenshotDiffDirectory(function(err){
          expect(err).toBeFalsy();
          expect(pitsa.env).toHaveBeenCalledWith('SCREENSHOT_DIFF_DIR');
          expect(pitsa.fs.readdir).toHaveBeenCalledWith('screenshot_diff_dir', jasmine.any(Function));
          done();
        });
      });
    });
    describe('createTemplateAndImageTags', function(){
      var template, filenames, image_tags;
      beforeEach(function(){
        template = {name: 'template'};
        image_tags = {name: 'image_tags'};
        filenames = [1, 2, 3];
        pitsa.TEMPLATE = function templateMock (cb) {
          return cb(null, template);
        };
        pitsa.createImageTags = function createImageTagsMock (filenames, cb) {
          return cb(null, image_tags);
        };
      });
      it('should be defined', function(){
        expect(pitsa.createTemplateAndImageTags).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'TEMPLATE').and.callThrough();
        spyOn(pitsa, 'createImageTags').and.callThrough();
        pitsa.createTemplateAndImageTags(filenames, function(err, result){
          expect(err).toBeFalsy();
          expect(pitsa.TEMPLATE).toHaveBeenCalledWith(jasmine.any(Function));
          expect(pitsa.createImageTags).toHaveBeenCalledWith([1,2,3], jasmine.any(Function));
          expect(result).toEqual({
            template: {name: 'template'},
            image_tags: {name: 'image_tags'}
          });
          done();
        });
      });
    });
    describe('createImageTags', function(){
      var filenames;
      beforeEach(function(){
        filenames = ['index.html', 'image1.png', 'image2.png'];
      });
      it('should be defined', function(){
        expect(pitsa.createImageTags).toBeDefined();
      });
      it('should call modules with right values', function(done){
        pitsa.createImageTags(filenames, function(err, result){
          expect(err).toBeFalsy();
          expect(result).toBe(
            'image1.png<br>\n' +
            '<img src="image1.png", alt="image1.png">\n' +
            '<hr>\n' +
            'image2.png<br>\n' +
            '<img src="image2.png", alt="image2.png">'
          );
          done();
        });
      });
    });
    describe('parseTemplate', function(){
      var object, responseMock, bodyMock;
      beforeEach(function(){
        pitsa.env = function envMock (key) {
          return key.toLowerCase();
        };
        bodyMock = {signature: 'some_signature'};
        responseMock = {statusCode: 200};
        object = {
          template: '{{images}}\n{{allow_url}}\n{{deny_url}}',
          image_tags: 'image tag stuff'
        };
        pitsa.request = function requestMock (request, cb) {
          return cb(null, responseMock, bodyMock);
        };
      });
      it('should be defined', function(){
        expect(pitsa.parseTemplate).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa, 'request').and.callThrough();
        pitsa.parseTemplate(object, function(err, result){
          expect(err).toBeFalsy();
          expect(pitsa.request).toHaveBeenCalledWith(
            {
              url: 'pitsa_server_urlregister',
              method: 'POST',
              json: true,
              headers: {'content-type': 'application/json'},
              body: {
                github_token: 'github_oauth_token',
                commit_hash: 'commit_hash',
                repository: 'project_reponame',
                owner: 'project_username',
                allow_description: 'allow_message',
                deny_description: 'deny_message'
              }
            },
            jasmine.any(Function)
          );
          expect(result).toBe(
            'image tag stuff\n' +
            'pitsa_server_urlsome_signature/allow\n' +
            'pitsa_server_urlsome_signature/deny'
          );
          done();
        });
      });
    });
    describe('writeToVerifyHtml', function(){
      var template, fbMock;
      beforeEach(function(){
        template = 'template data';
        fdMock = {name: 'fd'};
        pitsa.env = function envMock (key) {
          return key.toLowerCase();
        };
        pitsa.fs = {
          open: function open_mock (file_name, mode, cb) {
            return cb(null, fdMock);
          },
          write: function write_mock (fd, template, start_offset, length, end_offset, cb) {
            return cb();
          },
          close: function close_mock (fd, cb) {
            return cb();
          },
        };
      });
      it('should be defined', function(){
        expect(pitsa.writeToVerifyHtml).toBeDefined();
      });
      it('should call modules with right values', function(done){
        spyOn(pitsa.fs, 'open').and.callThrough();
        spyOn(pitsa.fs, 'write').and.callThrough();
        spyOn(pitsa.fs, 'close').and.callThrough();
        pitsa.writeToVerifyHtml(template, function(err){
          expect(err).toBeFalsy();
          expect(pitsa.fs.open).toHaveBeenCalledWith('verify_file', 'w', jasmine.any(Function));
          expect(pitsa.fs.write).toHaveBeenCalledWith(fdMock, new Buffer(template), 0, 13, 0, jasmine.any(Function));
          expect(pitsa.fs.close).toHaveBeenCalledWith(fdMock, jasmine.any(Function));
          done();
        });
      });
    });
    describe('endSkip', function(){
      var errorMock;
      it('should be defined', function(){
        expect(pitsa.endSkip).toBeDefined();
      });
      it('should call callback with undefined if no error', function(done){
        pitsa.endSkip(errorMock, function(error){
          expect(error).toBe(undefined);
          done();
        });
      });
      it('should call callback with error if error', function(done){
        errorMock = new Error('Test error');
        pitsa.endSkip(errorMock, function(error){
          expect(error).toBe(errorMock);
          done();
        });
      });
      it('should call callback with no error if error is pitsa.skip', function(done){
        errorMock = pitsa.skip;
        pitsa.endSkip(errorMock, function(error){
          expect(error).toBe(undefined);
          done();
        });
      });
    });
    describe('uploadScreenshots', function(){
      var archiveMock, S3Mock;
      beforeEach(function() {
        pitsa.env = function envMock (key) {
          return key.toLowerCase();
        };
        archiveMock = {
          directory: function directory_mock () {},
          finalize: function finalize_mock () {}
        };
        pitsa.archiver = {
          create: function create_mock () {
            return archiveMock;
          }
        };
        S3Mock = {
          upload: function upload_mock (params, cb) {
            return cb();
          }
        };
        pitsa.AWS = {
          S3: function s3_mock(){
            return S3Mock;
          }
        };
      });
      it('should be defined', function(){
        expect(pitsa.uploadScreenshots).toBeDefined();
      });
      it('should call callback S3 with right parameters', function(done){
        spyOn(S3Mock, 'upload').and.callThrough();
        pitsa.uploadScreenshots(function(error){
          expect(S3Mock.upload).toHaveBeenCalledWith({
            Bucket: 'screenshot_bucket_name',
            Key: 'commit_hash', Body: archiveMock}, jasmine.any(Function));
          done();
        });
      });
    });
  });
});
