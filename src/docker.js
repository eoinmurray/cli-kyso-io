const { spawnSync, spawn } = require('child_process')
const Docker = require('dockerode')
const path = require('path')
const fs = require('fs-extra')
const opn = require('opn')
const studyJSON = require('./get-study-json')
const wait = require('./utils/output/wait')
const cfg = require('./kyso-cfg')
const { homedir } = require('os')

module.exports = class {
  constructor(kyso) {
    this.kyso = kyso
    this.image = 'kyso/jupyter'

    const dockerFile = path.join(process.cwd(), `Dockerfile`)
    if (fs.existsSync(dockerFile)) {
      const dockerString = fs.readFileSync(dockerFile)
      const line0 = dockerString.toString().split('\n')[0]
      this.image = line0.slice(19).trim()
    } else if (kyso && kyso.pkg && kyso.pkg.docker && kyso.pkg.docker.image) {
      this.image = kyso.pkg.docker.image
    }
  }

  async pull() {
    return spawnSync('docker', ['pull', this.image], { stdio: 'inherit' })
  }

  async run(args) {
    await this.checkForImage()
    if (this.image !== 'kyso/jupyter') {
      console.log(`\n\nFound local Dockerfile. Starting ${this.image}\n\n`)
    }
    const cmd = spawn('docker', args, { stdio: [0, 'pipe', 0] })
    cmd.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      if (chunk.includes('?token=')) {
        const lines = chunk.toString().split('\n')
        lines.forEach(line => {
          if (line.includes('?token=') && !line.includes('Notebook')) {
            opn(line.trim())
          }
        })
      }
      if (chunk.includes('Jupyter dashboard server listening on')) {
        opn(`http://0.0.0.0:3000`)
      }
    })
  }

  async bash(extraArgs) {
    if (!extraArgs || extraArgs.length === 0) extraArgs = ['bash'] // eslint-disable-line
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '8888:8888', this.image]
    return this.run(args.concat(extraArgs))
  }

  async bashKeep(extraArgs) {
    await this.checkForImage()
    if (!extraArgs || extraArgs.length === 0) extraArgs = ['bash'] // eslint-disable-line
    const cwd = process.cwd()
    const args = ['create', '-v', `${cwd}:/home/ds/notebooks`, this.image]
    const re = await spawnSync('docker', args)
    const containerId = `${re.stdout}`.trim()
    await spawnSync('docker', ['start', containerId])
    await spawnSync('docker', ['exec', '-it', containerId].concat(extraArgs), { stdio: 'inherit' })
    await spawnSync('docker', ['stop', containerId], { stdio: 'inherit' })
    const name = this.createImageName()
    await spawnSync('docker', ['commit', '-m', extraArgs, containerId, name], { stdio: 'inherit' })
    await spawnSync('docker', ['rm', containerId])
    await studyJSON.merge(this.kyso.dir, { docker: { image: name } })
  }

  async jupyter(extraArgs) {
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '8888:8888', this.image]
    return this.run(args.concat(extraArgs))
  }

  async dashboard(extraArgs) {
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '3000:3000', this.image, '/home/ds/scripts/dashboard.sh']
    return this.run(args.concat(extraArgs))
  }

  async jupyterHttp(extraArgs) {
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '8889:8888', this.image, '/home/ds/scripts/jupyter-http.sh']
    return this.run(args.concat(extraArgs))
  }

  async python3(extraArgs) {
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '8888:8888', this.image, 'python3']
    return this.run(args.concat(extraArgs))
  }

  async python2(extraArgs) {
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '8888:8888', this.image, 'python2']
    return this.run(args.concat(extraArgs))
  }

  async node(extraArgs) {
    const cwd = process.cwd()
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', '8888:8888', this.image, 'node']
    return this.run(args.concat(extraArgs))
  }

  async default(extraArgs) {
    const cwd = process.cwd()
    const dockerFile = path.join(process.cwd(), `Dockerfile`)
    let port = '8888'
    if (fs.existsSync(dockerFile)) {
      const dockerString = fs.readFileSync(dockerFile)
      const lines = dockerString.toString().split('\n')
      const exposeLine = lines.filter(line => line.startsWith('EXPOSE'))
      if (exposeLine) {
        port = exposeLine[0].slice(7).trim()
      }
    }
    const args = ['run', '--rm', '-it', '-v', `${cwd}:/home/ds/notebooks`, '-p', `${port}:${port}`, this.image]
    return this.run(args.concat(extraArgs))
  }

  async build() {
    /*
      TODO: make this more fault tolerant with reading the name
    */
    let s = () => {}
    const dockerFile = path.join(process.cwd(), `Dockerfile`)
    if (!fs.existsSync(dockerFile)) {
      return console.log(`No Dockerfile`)
    }

    let name = this.createImageName()
    try {
      const dockerString = fs.readFileSync(dockerFile)
      const line0 = dockerString.toString().split('\n')[0]
      name = line0.slice(19).trim()
    } catch (e) {} // eslint-disable-line

    s = wait(`Extending kyso/jupyter image into ${name}`)
    const args = ['build', '-t', name, '.']
    await spawnSync('docker', args, { stdio: 'inherit' })
    s()
    return console.log(`\n\nBuild finished. Run using 'kyso <jupyter | dashboard | python | jupyter-http>'`)
  }

  async extend() {
    const dockerFile = path.join(process.cwd(), `Dockerfile`)
    if (fs.existsSync(dockerFile)) {
      return console.log(`Dockerfile already exists, not overwriting.`)
    }

    let template = `FROM kyso/jupyter\n\n# Add your commands here, example:\n# RUN pip install django\n`

    if (fs.existsSync(path.join(process.cwd(), `requirements.txt`))) {
      console.log(`requirements.txt exists, adding to Dockfile`)
      template = `FROM kyso/jupyter\n\nADD requirements.txt /tmp/requirements.txt\nRUN pip3 install -r /tmp/requirements.txt --user`
    }

    template = `# kyso-image-name: ${this.createImageName()}\n${template}`

    await fs.writeFile(dockerFile, template)
    return console.log(`Wrote new Dockerfile at '${dockerFile}'.\nRun 'kyso build' to build.`)
  }

  async checkForImage() {
    try {
      const docker = new Docker()
      const images = await docker.listImages()
      const tags = [].concat.apply([], images.map(image => image.RepoTags)) // eslint-disable-line

      if (!(tags.includes(this.image) || tags.includes(`${this.image}:latest`))) {
        this.pull()
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

  createImageName() {
    if (this.kyso.pkg && this.kyso.pkg.author && this.kyso.pkg.name) {
      return `kyso-local/${this.kyso.pkg.author}-${this.kyso.pkg.name}`
    }
    const dir = path.basename(__dirname)
    try {
      if (debug) {
        const file = path.resolve(homedir(), '.kyso-dev.json')
        cfg.setConfigFile(file)
      }
      const author = cfg.read().nickname
      return `kyso-local/${author}-${dir}`
    } catch (e) {
      return `kyso-local/${dir}`
    }
  }
}
