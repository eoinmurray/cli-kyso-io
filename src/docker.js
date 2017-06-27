const { spawn } = require('child_process')
const { readFile, writeFile } = require('fs-extra')
const studyJSON = require('./get-study-json')
const { resolve: resolvePath } = require('path')
const Stream = require('stream')
const Docker = require('dockerode')
const opn = require('opn')
const dockerStream = require('./utils/output/docker-stream')


module.exports = class {
  constructor(kyso) {
    this.kyso = kyso

    this.image = 'kyso/kyso-jupyter'
    if (kyso && kyso.pkg && kyso.pkg.docker && kyso.pkg.docker.image) {
      this.image = kyso.pkg.docker.image
    }

    this.docker = new Docker()
    this.container = null
    this.started = false
    this.token = null
  }

  parseToken(chunk) {
    process.stdout.write(chunk)
    if (chunk.includes('?token=')) {
      // get the token
      const lines = chunk.toString().split('\n')
      lines.forEach(line => {
        if (line.includes('?token=') && !line.includes('Notebook')) {
          this.token = line.trim().split('?token=')[1]
          this.open()
        }
      })
    }
  }

  stop() {
    if (this.started) {
      console.log(`docker stop ${this.container.id}`)
      // this.container.stop()
      spawn(`docker`, [`stop`, `${this.container.id}`], {
        detached: true,
        // stdio: 'ignore'
      })
      this.started = false
    }

    process.removeListener('SIGTERM', this.stop)
    process.removeListener('SIGINT', this.stop)
  }

  async build() {
    try {
      const stream = await this.docker.buildImage({ context: process.cwd(), src: ['Dockerfile'] }, {
        t: `kyso-user/${this.kyso.pkg.name}`
      })
      stream.pipe(dockerStream)
      this.image = `kyso-user/${this.kyso.pkg.name}`
      return true
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        const e = new Error('Docker is not installed or its not turned on.')
        e.userError = true
        throw e
      }
      throw err
    }
  }

  async start(port = 8888) {
    return this.run(port)
  }

  async run(port = 8888) {
    this.port = port
    this.container = null
    this.started = false
    this.token = null
    if (this.image === ".") {
      console.log(`\nRebuilding image\n`)
      await this.build()
      console.log(`\nDone building image: ${this.image}\n`)
    } else {
      try {
        const images = await this.docker.listImages()
        const tags = [].concat.apply([], images.map(image => image.RepoTags)) // eslint-disable-line

        if (!(tags.includes('kyso/kyso-jupyter') || tags.includes('kyso/kyso-jupyter:latest'))) {
          return console.log(`kyso/kyso-jupyter image not installed. Run 'docker pull kyso/kyso-jupyter'`)
        }
      } catch (err) {
        if (err.code === 'ECONNREFUSED') {
          const e = new Error('Docker is not installed or its not turned on.')
          e.userError = true
          throw e
        }
        throw err
      }
    }

    // https://docs.docker.com/engine/api/v1.27/#operation/ContainerCreate
    const createOpts = {
      Image: this.image,
      HostConfig: {
        Binds: [
          `${process.cwd()}:/home/ds/notebooks`
        ],
        PortBindings: {
          "8888/tcp": [{ HostPort: `${port}` }]
        },
      },
      AttachStdout: true,
      AttachStderr: true
    }

    this.container = await this.docker.createContainer(createOpts)

    process.once('exit', () => this.stop())
    process.once('SIGINT', () => this.stop())
    process.once('SIGTERM', () => this.stop())

    const stream = await this.container.attach({
      stream: true, stdout: true, stderr: true, tty: true
    })

    const stdout = new Stream.Writable({
      write: (chunk, encoding, next) => {
        this.parseToken(chunk)
        next()
      }
    })

    stream.pipe(stdout)
    console.log(`\nStarting container ${this.container.id} exposed on port ${port}`)
    this.started = true

    try {
      await this.container.start()
    } catch (e) {
      if (e.json && e.json.message) {
        if (!e.json.message.includes('port is already allocated')) {
          throw e
        }
        stdout.end()
        this.run(port + 1)
      }
    }
  }

  async open() {
    if (this.token) opn(`http://localhost:${this.port}/?token=${this.token}`)
  }

  async init() {
    try {
      await readFile(resolvePath(this.kyso.dir, 'Dockerfile'))
      const e = new Error(`Dockerfile already exists in ${this.kyso.dir}`)
      e.userError = true
      throw e
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }

      const template = `FROM kyso/kyso-jupyter
USER root

# here you can run extra things like pip install
# RUN pip install somepackage

USER ds
`
      await writeFile(resolvePath(this.kyso.dir, 'Dockerfile'), template)
      await studyJSON.merge(this.kyso.dir, {
        docker: {
          image: "."
        }
      })
      console.log(`Created Dockerfile`)
      console.log(`Use 'kyso docker run' to start docker app`)
    }
  }
}
