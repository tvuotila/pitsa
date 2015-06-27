# Pitsa [![Build Status Images](https://travis-ci.org/tvuotila/pitsa.svg)](https://travis-ci.org/tvuotila/pitsa/) [![codecov.io](http://codecov.io/github/tvuotila/pitsa/coverage.svg?branch=master)](http://codecov.io/github/tvuotila/pitsa?branch=master) [![npm version](https://badge.fury.io/js/pitsa.svg)](http://badge.fury.io/js/pitsa) [![dependencies](https://david-dm.org/tvuotila/pitsa.svg)](https://david-dm.org/tvuotila/pitsa) [![devDependencies](https://david-dm.org/tvuotila/pitsa/dev-status.svg)](https://david-dm.org/tvuotila/pitsa#info=devDependencies)
[![NPM](https://nodei.co/npm/pitsa.png)](https://nodei.co/npm/pitsa/)
Visual regression testing for Protractor (or Selenium) and CircleCI (or Travis CI) using Amazon S3. __Travis CI support is untested.__

## Installation
```
npm install pitsa
```


## Functionality
Pitsa takes screenshots and compares them to pull screenshots from reguest target branch. If screenhots differ, user is asked to approve them manually. GitHub status is set indicating that manual review is needed. ![pending status](/examples/pending.png) Pitsa creates [a webpage](examples/screenshot_diffs/VERIFY.html) containing images with changes colored red. User can mark pull request either approved ![approved status](/examples/approved.png) or disapproved. ![disapproved status](/examples/disapproved.png) Approval or dissapproval is marked straight to Github pull request. Screenshot comparison status is separate from test results in order to differentiate between programming error and visual error.


## Usage
1. Set required environment variables:
	- GITHUB_OAUTH_TOKEN
		- For setting up status messages
		- For finding pull request info
	- AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
		- or [~/.aws/credentials](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) file
		- for uploading and downloading screenshot archives to/from Amazon S3
	- SCREENSHOT_BUCKET_NAME
		- Amazon S3 bucket to upload/download screenshots to/from.
	- CAPTURE_SCREENSHOTS
		- Must evaluate to true value for example `yes` .
		- Pitsa saves screenshots if value is true.
		- Allows to run tests on development environment without taking screenshots.

2. Call Pitsa from your tests:
	```
	var pitsa = require('pitsa')(browser);
	afterEach(function(){
	  pitsa.screenshot();
	});
	```
	or save images you want to compare to screenshot directory (default `screenshots`).

3. Execute Pitsa after your tests. Remember to save build artifacts. You can for example add following to circle.yml:
	```
	test:
	  post:
	    - pitsa
	 general:
	  artifacts:
	    - screenshots
	    - old_screenshots
	    - screenshot_diffs
	```
4. If screenshots changed:

	4.1. You will see yellow status mark on GitHub and build artifacts have file `screenshot_diffs/VERIFY.html`.

	4.2 Open the file to see all changed screenshots.

	4.3 Mark changes as good by clicking green "GOOD" link or bad by clicking red "BAD" link.


## About Pitsa server
We need to save your GitHub token and information about your pull request securely so that VERIFY.html doesn't contain any sensitive information. Pitsa server is for this reason. Server responds with secure 150 byte long random hash. The hash can be used to mark screenshot changes either approved or denied. There is no way to retrieve the token or the information even with the secure hash. We will use the GitHub token only to update pull request status. Data is deleted after 30 days or when our Heroku PostgreSQL space runs out. Server deletes oldest entries when space is getting low. Example of data sent to the server:
```
{
  "github_token": "5631401ae8a9140997be8f65d7f979ceefa313c7",
  "commit_hash": "7599a900e7a598f6bd4f1990fb1214137e643aa3",
  "repository": "awesome-website",
  "owner": "tvuotila",
  "allow_description": "Screenshot changes are approved.",
  "deny_description": "Please fix the screenshot changes."
}
```

## Optional enviroment variables:

- DEBUG
	- Set to `pitsa:*` or `*` to print all debug logs.
	- `pitsa:main` prints logs only from functions in main execution pipeline.
	- `pitsa:helper` prints logs only from functions not in main execution pipeline.
	- See [debug](https://www.npmjs.com/package/debug) for more information.
- SCREENSHOT_DIR
	- Directory where screenshots will be saved
	- Defaults to `screenshots`
- SCREENSHOT_DIFF_DIR
	- Directory for screenshot comparison images.
	- Defaults to `screenshot_diffs`
- TEMP_SCREENSHOT_DIR
	- Temporary directory to move screenshots around.
	- Defaults to `screenshots_tmp`
- OLD_SCREENSHOT_DIR
	- Directory where old screenshots will be saved.
	- Defaults to `old_screenshots`
- PENDING_MESSAGE
	- Message to show on GitHub if screenshots have changed.
	- Defaults to `Please fix the screenshot changes.`
- ALLOW_MESSAGE
	- Message to show when user has approved changes.
	- Defaults to `Screenshot changes are approved.`
- DENY_MESSAGE
	- Message to show when user rejects changes.
	- Defaults to `Please fix the screenshot changes.`
- PULL_REQUEST_URL
	- Override Circle CI pull request url
- PULL_REQUEST_NUMBER
	- Override Travis CI pull request number
- PROJECT_USERNAME
	- Override repository owner
- PROJECT_REPONAME
	- Override repository name
- COMMIT_HASH
	- Override hash of current commit.
- VERIFY_FILE
	- Path to verify.html
	- Defaults to `$SCREENSHOT_DIFF_DIR/VERIFY.html`
- GITHUB_API_HOST
	- Override GitHub api url
- PITSA_SERVER_URL
	- Override Pitsa server url.

## FAQ
1. Why "Pitsa"?

	A. It comes from "Pull request Interactive Test Screenshot Approver".
2. Any questions or problems? Open an issue.
