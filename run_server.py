#!/usr/bin/env python3
"""
Simple HTTP server to run Sort Your Music locally.
This serves the web directory on localhost:8000
"""
import http.server
import socketserver
import os
import sys
import webbrowser
import threading
import time

# Change to the web directory
os.chdir('web')

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

def open_browser():
    """Open browser after a short delay to ensure server is running"""
    time.sleep(1)
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == "__main__":
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print(f"🎵 Sort Your Music is running at http://localhost:{PORT}")
            print("Opening browser...")
            print("Press Ctrl+C to stop the server")
            
            # Open browser in a separate thread
            browser_thread = threading.Thread(target=open_browser, daemon=True)
            browser_thread.start()
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        sys.exit(0)
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Please close other applications using this port.")
        else:
            print(f"❌ Error starting server: {e}")
        sys.exit(1) 