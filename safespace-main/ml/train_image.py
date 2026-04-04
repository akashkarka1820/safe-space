import os
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2, ResNet50
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
import pandas as pd
import json
import sqlite3
from datetime import datetime
from PIL import Image
import numpy as np

DATA_DIR = r"C:\Users\saira\Downloads\archive\data"
JSONL_FILE = os.path.join(DATA_DIR, "train.jsonl")
IMG_DIR = os.path.join(DATA_DIR, "") # the jsonl has 'img/xxx.png' paths
DB_PATH = r"C:\Users\saira\safespace\app.db"
MODEL_DIR = r"C:\Users\saira\safespace\ml\models"

if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)

def save_metric_to_db(model_name, model_type, acc, prec, rec, f1):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='model_metrics'")
    if cursor.fetchone() is not None:
        cursor.execute('''
            INSERT INTO model_metrics (model_name, model_type, accuracy, precision, recall, f1_score, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (model_name, model_type, float(acc), float(prec), float(rec), float(f1), datetime.utcnow()))
        conn.commit()
    conn.close()

def load_data(limit=1000):
    images = []
    labels = []
    print("Loading image metadata map...")
    count = 0
    with open(JSONL_FILE, "r") as f:
        for line in f:
            if count >= limit:
                break
            record = json.loads(line)
            img_path = os.path.join(IMG_DIR, record['img'])
            if os.path.exists(img_path):
                images.append(img_path)
                labels.append(record['label'])
                count += 1
    return pd.DataFrame({"filename": [p.replace("\\", "/") for p in images], "label": labels}) # filenames for flow_from_dataframe

def build_model(base_model_class):
    base_model = base_model_class(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(128, activation='relu')(x)
    predictions = Dense(1, activation='sigmoid')(x)
    
    model = Model(inputs=base_model.input, outputs=predictions)
    for layer in base_model.layers: # freeze base for fast training
        layer.trainable = False
        
    model.compile(optimizer=Adam(learning_rate=0.001), loss='binary_crossentropy', metrics=['accuracy', tf.keras.metrics.Precision(name='precision'), tf.keras.metrics.Recall(name='recall')])
    return model

def train_image_models():
    # Use small subset for faster demo execution
    df = load_data(limit=2000)
    df['str_label'] = df['label'].astype(str)
    
    datagen = tf.keras.preprocessing.image.ImageDataGenerator(rescale=1./255, validation_split=0.2)
    
    train_gen = datagen.flow_from_dataframe(
        dataframe=df,
        x_col="filename",
        y_col="str_label",
        target_size=(224, 224),
        batch_size=32,
        class_mode="binary",
        subset="training"
    )
    val_gen = datagen.flow_from_dataframe(
        dataframe=df,
        x_col="filename",
        y_col="str_label",
        target_size=(224, 224),
        batch_size=32,
        class_mode="binary",
        subset="validation"
    )
    
    models = {
        "mobilenetv2": MobileNetV2,
        "resnet50": ResNet50
    }
    
    for name, model_class in models.items():
        print(f"Training {name} image model...")
        model = build_model(model_class)
        history = model.fit(train_gen, validation_data=val_gen, epochs=2) # 2 epochs for quick setup
        
        # evaluation metrics from last epoch val
        val_acc = history.history['val_accuracy'][-1]
        val_prec = history.history['val_precision'][-1]
        val_rec = history.history['val_recall'][-1]
        f1 = (2 * val_prec * val_rec) / (val_prec + val_rec + 1e-7)
        
        model.save(os.path.join(MODEL_DIR, f"{name}.h5"))
        save_metric_to_db(name, "image", val_acc, val_prec, val_rec, f1)

if __name__ == "__main__":
    train_image_models()
