from app import create_app
import os

app = create_app()

@app.route('/health')
def health():
    return {'status': 'ok', 'message': 'MIT-ADT Faculty Portal Running'}, 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") != "production"
    app.run(debug=debug, host='0.0.0.0', port=port)
