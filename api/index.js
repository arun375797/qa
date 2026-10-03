import app from '../server/src/server.js'

export default function handler(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const path = url.searchParams.get('path') || ''
  url.searchParams.delete('path')

  const query = url.searchParams.toString()
  request.url = `/api/${path}${query ? `?${query}` : ''}`

  return app(request, response)
}
