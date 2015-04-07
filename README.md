# twitter-machine

## Requirements and configuration

### Install Meteor:
`curl https://install.meteor.com/ | sh`

### Create a new Twitter application
Using your twitter account, [create a new application](https://apps.twitter.com).
Your app will impersonate this account so pick the right one.
Add "read/write + access direct messages" permissions in the 'Permissions' tab.
Generate the keys and access tokens.

### Create a json file with your secret keys and tokens
Create a `private` directory: `mkdir twitter-machine/private`.
Create a file called `twitter-secret.json` in the `private` directory looking like this:
`{
  "consumer_key": "",
  "consumer_secret": "",
  "access_token": "",
  "access_token_secret": ""
}`

Don't forget to replace the `""` with your twitter data!

## Launch
`cd twitter-machine`
`meteor`

Access it through [http://localhost:3000/](http://localhost:3000/)