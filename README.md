
# Kyso CLI

## Installation

First you need node.js and npm - you can get these by install [downloading and installing node](https://nodejs.org/en/download/current/) (npm comes bundled with node).

```
npm install -g kyso
```

Then just type

```
kyso login
```

into your terminal.

## Usage

### Publish a Jupyter notebook

Go to your project directory containing your notebook(s) and type

```
kyso push
```

thats it!

You can select the name of the online notebook by using `kyso create` first.

## Run Jupyter/python3/python2 without installing!

Kyso supports the [kyso/jupyter](https://github.com/kyso-io/kyso-docker-jupyter) docker image. This means that
if you have docker installed ([you can get it free here](https://store.docker.com/search?type=edition&offering=community))
you can run Jupyter notebooks, Jupyter dashboards, and python2 and python3 without installing them.

Just use the following commands:

- `kyso jupyter` -  Opens a Jupyter notebook

- `kyso dashboard` -  Starts the current dir as a Jupyter dashboard

- `kyso jupyter-http` - Starts a notebook in http mode

- `kyso python` -  or kyso python3 Starts python3.5

- `kyso python2` -  Starts python2.7

- `kyso node` -  Starts node.js

- `kyso bash` -  Starts bash inside the container

- `kyso docker` -  run Starts the default docker command

See more info about extending, and building your own image in the [kyso/jupyter](https://github.com/kyso-io/kyso-docker-jupyter) repo.

## Development

```
git clone https://github.com/kyso-io/kyso-cli
cd kyso-cli
yarn
```

Run `npm run link` then you can access the `kyso` command.
