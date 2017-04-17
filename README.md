
# cli-kyso-io

Name is already reserved on npm.

## Development

Run the app by going `node bin/kyso <your command>`.

## Publish

1. Update the version in 'package.json'
2. `npm publish`

## Documentation

### Installation

`npm install -g kyso`

### Login

`kyso login`

Kyso will prompt you to enter your account email address, and prompt you for a code. Our servers will email you a code, enter the code and your logged in.

### Teams

`kyso teams < ls | create | rm >`

### Invites

`kyso invites < ls | add | rm >`

### Studies

`kyso studies < ls | create | rm >`

### Tags

`kyso tags < ls | create | rm >`
