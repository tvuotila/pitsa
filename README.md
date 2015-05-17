# Pitsa
Visual regression testing for Protractor (or Selenium) and CircleCI (or Travis CI) using Amazon S3. __Travis CI support is untested.__

## Installation
```
npm install pitsa
```

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

3. Execute Pitsa after your tests and save screenshots, for example by adding following to your circle.yml:
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
We need to save your GitHub token and information about your pull request securely so that VERIFY.html doesn't contain any sensitive information. Pitsa server is for this reason. Server responds with secure 150 byte long random hash for marking screenshot changes either approved or denied. There is no way to retrieve your information even with the secure hash. We will use GitHub token only to update pull request status. Data is deleted after 30 days (or when our Heroku PostgreSQL space runs out. Server deletes oldest entries when space is getting low to make space.)

## Optional enviroment variables:

- DEBUG
	- Set to `pitsa` or `*` to print debug logs.
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
