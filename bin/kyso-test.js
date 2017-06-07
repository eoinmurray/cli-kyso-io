#!/usr/bin/env node
const getCommandArgs = require('../src/command-args')
const { handleError } = require('../src/error')
const Kyso = require('../src');

(async () => {
  try {
    const { argv, token, apiUrl } = await getCommandArgs()

    const kyso = new Kyso({
      url: apiUrl,
      token,
      debug: argv.debug,
      dir: process.cwd()
    })

    const Parse = kyso.parse
    const fileQuery = new Parse.Query(Parse.Object.extend('File'))
    const studyQuery = new Parse.Query(Parse.Object.extend('Study'))

    studyQuery.equalTo('name', 'bokeh')
    studyQuery.equalTo('author', 'test-user')

    fileQuery.matchesQuery('study', studyQuery)
    fileQuery.include('study')

    const files = await fileQuery.find({ sessionToken: token })
    console.log(files[0].toJSON())
  } catch (err) {
    handleError(err)
  }
})()
