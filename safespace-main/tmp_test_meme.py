import os, json
import numpy as np
import tensorflow as tf

m = tf.keras.models.load_model(r'C:\Users\saira\safespace\ml\models\mobilenetv2.h5')
DATA = r'C:\Users\saira\Downloads\archive\data'

with open(os.path.join(DATA, 'train.jsonl')) as f:
    lines = [json.loads(next(f)) for _ in range(5)]

for record in lines:
    img_path = os.path.join(DATA, record['img'])
    label = record['label']
    
    img = tf.keras.preprocessing.image.load_img(img_path, target_size=(224,224))
    arr = tf.keras.preprocessing.image.img_to_array(img)
    arr = np.expand_dims(arr, axis=0) / 255.0
    pred = m.predict(arr, verbose=0)[0][0]
    
    print(f"Label: {label}, Prediction: {pred:.4f}")
