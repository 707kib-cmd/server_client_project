import http.server

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        response = b"OK"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(response)
        self.wfile.flush()

http.server.HTTPServer(("localhost", 8123), Handler).serve_forever()