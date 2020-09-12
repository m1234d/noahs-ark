from flask import Flask
from flask import render_template, send_file

import matplotlib.pyplot as plt
import os
import time

from datetime import datetime
import requests
from PIL import Image
from io import BytesIO, StringIO

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.layers import Input, Dense, Conv2D, MaxPooling2D, UpSampling2D
from tensorflow.keras.models import Model

from tensorflow.keras.datasets import mnist
from tensorflow.keras import backend as K
import numpy as np
from tifffile import imread
import tifffile

app = Flask(__name__, template_folder='./static')
modelAuto = None
sz = (256,256,3)
@app.route('/')
def hello_world():
    return render_template('index.html')

@app.route('/getFloodMap')
def get_flood_map():
    global modelAuto
    locStr = "40.66841,-74.081099"
    image = np.asarray(getLocationImage(locStr).convert('RGB').resize((256, 256)))
    img2 = np.array([image]).astype('float32') / 255
    res = modelAuto.predict(img2)
    res2 = (res[0].reshape(sz) * 255.0).astype('uint8')
    newImg = Image.fromarray(res2)
    return serve_pil_image(newImg)

def serve_pil_image(pil_img):
    img_io = BytesIO()
    pil_img.save(img_io, 'JPEG', quality=70)
    img_io.seek(0)
    return send_file(img_io, mimetype='image/jpeg')

def server_init():
    global modelAuto
    modelAuto = keras.models.load_model('model')

def ai(normalImage, newImage, testImage):
    input_img = Input(shape=sz)  # adapt this if using `channels_first` image data format

    x = Conv2D(16, (3, 3), activation='relu', padding='same')(input_img)
    x = MaxPooling2D((2, 2), padding='same')(x)
    x = Conv2D(8, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D((2, 2), padding='same')(x)
    encoded = Dense(16, activation='relu')(x)

    # (28, 28, 1)
    # at this point the representation is (4, 4, 8) i.e. 128-dimensional

    x = Dense(8, activation='relu')(encoded)
    x = Conv2D(8, (3, 3), activation='relu', padding='same')(x)
    x = UpSampling2D((2, 2))(x)
    x = Conv2D(16, (3, 3), activation='relu', padding='same')(x)
    x = UpSampling2D((2, 2))(x)
    decoded = Conv2D(3, (3, 3), activation='sigmoid', padding='same')(x)

    autoencoder = Model(input_img, decoded)
    print(autoencoder.summary())
    opt = keras.optimizers.Adam(learning_rate=0.005)
    autoencoder.compile(optimizer=opt, loss='mse')


    x_train = np.array(normalImage)
    y_train = np.array(newImage)
    x_test = np.array(testImage)
    x_train = x_train.astype('float32') / 255.
    x_test = x_test.astype('float32') / 255.
    y_train = y_train.astype('float32') / 255.
    print(x_train.shape)
    print(x_test.shape)

    autoencoder.fit(x_train, y_train,
                epochs=200,
                batch_size=len(normalImage),
                shuffle=True)

    autoencoder.save("model")

    decoded_imgs = autoencoder.predict(x_test)

    n = len(testImage)
    plt.figure(figsize=(20, 4))
    for i in range(n):
        # display original
        ax = plt.subplot(2, n, i + 1)
        plt.imshow(x_test[i].reshape(sz))
        plt.gray()
        ax.get_xaxis().set_visible(False)
        ax.get_yaxis().set_visible(False)

        # display reconstruction
        ax = plt.subplot(2, n, i + 1 + n)
        plt.imshow(decoded_imgs[i].reshape(sz))
        plt.gray()
        ax.get_xaxis().set_visible(False)
        ax.get_yaxis().set_visible(False)
    plt.show()


def getLocationString(westCoord, northCoord):
    degrees = float(westCoord[0:3]) - (0.84/69.1)
    minutes = float(westCoord[3:5])
    seconds = float(westCoord[5:7])
    westDec = degrees + (minutes/60) + (seconds/3600)

    degrees = float(northCoord[0:2]) - (0.85/69.1)
    minutes = float(northCoord[2:4])
    seconds = float(northCoord[4:6])
    northDec = degrees + (minutes/60) + (seconds/3600)

    return str(northDec) + ",-" + str(westDec)

def train():
    normalImages = []
    newImages = []
    #for filename in os.listdir("images"):
    special = ['20170831bC0950300w294630n.tif', '20170831bC0950300w294800n.tif', '20170831bC0950300w294930n.tif', '20170831bC0950430w294630n.tif', '20170831bC0950430w294800n.tif', '20170831bC0950430w294930n.tif', '20170831bC0950600w294630n.tif', '20170831bC0950600w294800n.tif', '20170831bC0950600w294930n.tif', '20170831bC0950730w294630n.tif', '20170831bC0950730w294800n.tif', '20170831bC0950730w294930n.tif', '20170831bC0950900w294200n.tif', '20170831bC0950900w294330n.tif', '20170831bC0950900w294500n.tif', '20170831bC0950900w294630n.tif', '20170831bC0950900w294800n.tif', '20170831bC0950900w294930n.tif', '20170831bC0951030w294200n.tif', '20170831bC0951030w294330n.tif']
    for filename in special:
        if filename.endswith(".tif"): 
            filename2 = filename.split('C')[1]
            coords = filename2.split('w')
            westCoord = coords[0]
            northCoord = coords[1][:-5]
            locStr = getLocationString(westCoord, northCoord)
            normalImage= np.asarray(getLocationImage(locStr).convert('RGB').resize((256, 256)))
            floodImage = np.asarray(Image.open("./images/" + filename).resize((256, 256)).convert('RGB'))
            #Image.fromarray(normalImage).show()
            newImage = floodImage - normalImage
            normalImages.append(normalImage)
            newImages.append(newImage)

    testImages = [np.asarray(getLocationImage("40.66841,-74.081099").convert('RGB').resize((256, 256)))]
    testImages.append(np.asarray(getLocationImage("25.1795,-80.3840").convert('RGB').resize((256, 256))))
    testImages.append(np.asarray(getLocationImage("25.909258, -80.135660").convert('RGB').resize((256, 256))))
    testImages.append(np.asarray(getLocationImage("38.622988, -90.181813").convert('RGB').resize((256, 256))))
    testImages.append(np.asarray(getLocationImage("30.145418, -85.665211").convert('RGB').resize((256, 256))))
    ai(normalImages, newImages, testImages)



def getLocationImage(locStr):
    s = f"""https://maps.googleapis.com/maps/api/staticmap?center="{locStr}"&zoom=15&size=800x800&scale=2&maptype=satellite&key=AIzaSyDtXwIjsIVUjlj_OyyhUDEE8khkACXMjp8"""
    print(s)
    r = requests.get(s)
    i = Image.open(BytesIO(r.content))
    return i

if __name__ == "__main__":
    train()
else:
    server_init()
