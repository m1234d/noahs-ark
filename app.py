from flask import Flask
from flask import render_template
app = Flask(__name__, template_folder='./static')

@app.route('/')
def hello_world():
    return render_template('index.html')