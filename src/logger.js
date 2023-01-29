
import winston from 'winston'

// destructuring the winston object to get the createLogger, transports and format objects

const { createLogger, transports, format } = winston

const myFormat = format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)

export default createLogger({
  transports: [
    new transports.Console()
  ],
  format: format.combine(
    format.timestamp(),
    myFormat
  )
})
