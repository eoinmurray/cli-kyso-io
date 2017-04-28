const Docker = require('dockerode')
const Stream = require('stream')
const opn = require('opn')
const { spawn } = require('child_process')

module.exports = class {
  constructor(kyso) {
    this.kyso = kyso
    this.image = (kyso.pkg.docker && kyso.pkg.docker.image) || 'kyso-jupyter'
    this.docker = new Docker()
    this.container = null
    this.started = false
    this.url = null
    this.stdout = new Stream.Writable({
      write: (chunk, encoding, next) => {
        this.parseToken(chunk)
        next()
      }
    })
  }

  parseToken(chunk) {
    process.stdout.write(`${chunk}`)
    if (chunk.includes('?token=')) {
      // get the token
      const lines = chunk.toString().split('\n')
      lines.forEach(line => {
        if (line.includes('?token=') && !line.includes('Notebook')) {
          this.url = line.trim()
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
        stdio: 'ignore'
      })
      this.started = false
    }

    process.removeListener('SIGTERM', this.stop)
    process.removeListener('SIGINT', this.stop)
  }

  async build() {
    console.log(`Building extended image`)
    const stream = await this.docker.buildImage({ context: process.cwd(), src: ['Dockerfile'] }, {
      t: `docker-image-${this.kyso.pkg.name}`
    })

    stream.pipe(process.stdout)
    this.image = `docker-image-${this.kyso.pkg.name}`
  }

  async run(port = 8888) {
    if (this.image === ".") {
      await this.build()
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

    stream.pipe(this.stdout)
    console.log(`Starting container ${this.container.id}`)
    this.started = true
    await this.container.start()
  }

  async open() {
    if (this.url) opn(this.url)
  }
}
