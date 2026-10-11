---
title: "Fotosintesis"
description: "Bahan ajar Biologi SMA tentang fotosintesis — pengertian, syarat, proses, dan hasil"
nodes:
    - id: "fotos"
      type: "text"
      position: { x: 620, y: 40 }
      data: { label: "Fotosintesis", color: "green" }

    - id: "daun"
      type: "text"
      position: { x: 300, y: 180 }
      data: { label: "Daun" }

    - id: "air"
      type: "text"
      position: { x: 520, y: 180 }
      data: { label: "Air (H₂O)" }

    - id: "glukosa"
      type: "text"
      position: { x: 740, y: 180 }
      data: { label: "Glukosa" }

    - id: "oksigen"
      type: "text"
      position: { x: 960, y: 180 }
      data: { label: "Oksigen" }

    - id: "kloroplas"
      type: "text"
      position: { x: 180, y: 340 }
      data: { label: "Kloroplas" }

    - id: "reaksi-terang"
      type: "text"
      position: { x: 620, y: 340 }
      data: { label: "Reaksi Terang" }

    - id: "reaksi-gelap"
      type: "text"
      position: { x: 900, y: 340 }
      data: { label: "Reaksi Gelap" }

    - id: "energi"
      type: "text"
      position: { x: 1140, y: 340 }
      data: { label: "Energi Kimia" }

    - id: "klorofil"
      type: "text"
      position: { x: 100, y: 500 }
      data: { label: "Klorofil" }

    - id: "cahaya"
      type: "text"
      position: { x: 420, y: 500 }
      data: { label: "Cahaya Matahari" }

    - id: "co2"
      type: "text"
      position: { x: 760, y: 500 }
      data: { label: "Karbon Dioksida (CO₂)" }

    - id: "stomata"
      type: "text"
      position: { x: 980, y: 640 }
      data: { label: "Stomata" }

    - id: "c-terjadi"
      type: "connector"
      position: { x: 450, y: 110 }
      data: { label: "terjadi di" }

    - id: "c-miliki"
      type: "connector"
      position: { x: 240, y: 260 }
      data: { label: "memiliki" }

    - id: "c-kandung"
      type: "connector"
      position: { x: 130, y: 420 }
      data: { label: "mengandung" }

    - id: "c-serap"
      type: "connector"
      position: { x: 260, y: 570 }
      data: { label: "menyerap" }

    - id: "c-masuk"
      type: "connector"
      position: { x: 870, y: 570 }
      data: { label: "masuk melalui" }

    - id: "c-berada"
      type: "connector"
      position: { x: 600, y: 460 }
      data: { label: "berada di" }

    - id: "c-butuh-air"
      type: "connector"
      position: { x: 560, y: 110 }
      data: { label: "membutuhkan" }

    - id: "c-pakai-cahaya"
      type: "connector"
      position: { x: 520, y: 420 }
      data: { label: "digunakan pada" }

    - id: "c-hasil-oksigen"
      type: "connector"
      position: { x: 770, y: 260 }
      data: { label: "menghasilkan" }

    - id: "c-butuh-co2"
      type: "connector"
      position: { x: 830, y: 420 }
      data: { label: "membutuhkan" }

    - id: "c-hasil-glukosa"
      type: "connector"
      position: { x: 810, y: 260 }
      data: { label: "menghasilkan" }

    - id: "c-hasil-glukosa-2"
      type: "connector"
      position: { x: 680, y: 110 }
      data: { label: "menghasilkan" }

    - id: "c-hasil-oksigen-2"
      type: "connector"
      position: { x: 820, y: 110 }
      data: { label: "menghasilkan" }

    - id: "c-simpan"
      type: "connector"
      position: { x: 1040, y: 260 }
      data: { label: "disimpan sebagai" }

edges:
    - id: "e1"
      source: "fotos"
      target: "c-terjadi"
    - id: "e2"
      source: "c-terjadi"
      target: "daun"
    - id: "e3"
      source: "daun"
      target: "c-miliki"
    - id: "e4"
      source: "c-miliki"
      target: "kloroplas"
    - id: "e5"
      source: "kloroplas"
      target: "c-kandung"
    - id: "e6"
      source: "c-kandung"
      target: "klorofil"
    - id: "e7"
      source: "klorofil"
      target: "c-serap"
    - id: "e8"
      source: "c-serap"
      target: "cahaya"
    - id: "e9"
      source: "co2"
      target: "c-masuk"
    - id: "e10"
      source: "c-masuk"
      target: "stomata"
    - id: "e11"
      source: "stomata"
      target: "c-berada"
    - id: "e12"
      source: "c-berada"
      target: "daun"
    - id: "e13"
      source: "fotos"
      target: "c-butuh-air"
    - id: "e14"
      source: "c-butuh-air"
      target: "air"
    - id: "e15"
      source: "cahaya"
      target: "c-pakai-cahaya"
    - id: "e16"
      source: "c-pakai-cahaya"
      target: "reaksi-terang"
    - id: "e17"
      source: "reaksi-terang"
      target: "c-hasil-oksigen"
    - id: "e18"
      source: "c-hasil-oksigen"
      target: "oksigen"
    - id: "e19"
      source: "reaksi-gelap"
      target: "c-butuh-co2"
    - id: "e20"
      source: "c-butuh-co2"
      target: "co2"
    - id: "e21"
      source: "reaksi-gelap"
      target: "c-hasil-glukosa"
    - id: "e22"
      source: "c-hasil-glukosa"
      target: "glukosa"
    - id: "e23"
      source: "fotos"
      target: "c-hasil-glukosa-2"
    - id: "e24"
      source: "c-hasil-glukosa-2"
      target: "glukosa"
    - id: "e25"
      source: "fotos"
      target: "c-hasil-oksigen-2"
    - id: "e26"
      source: "c-hasil-oksigen-2"
      target: "oksigen"
    - id: "e27"
      source: "glukosa"
      target: "c-simpan"
    - id: "e28"
      source: "c-simpan"
      target: "energi"
---

Fotosintesis adalah proses pembuatan makanan yang dilakukan oleh tumbuhan hijau. Proses ini terjadi di daun. Di dalam daun terdapat kloroplas, yaitu organel sel tempat berlangsungnya fotosintesis. Kloroplas mengandung pigmen hijau yang disebut klorofil.

Untuk berlangsungnya fotosintesis, tumbuhan memerlukan beberapa bahan. Klorofil menyerap cahaya matahari sebagai sumber energi. Air diserap oleh akar dari dalam tanah, sedangkan karbon dioksida (CO₂) masuk melalui stomata, yaitu pori-pori kecil yang berada di permukaan daun.

Fotosintesis berlangsung melalui dua tahap reaksi. Pada reaksi terang, cahaya matahari digunakan untuk memecah air sehingga dihasilkan oksigen. Kemudian, pada reaksi gelap, karbon dioksida diikat dan diolah menjadi glukosa.

Glukosa hasil fotosintesis disimpan sebagai energi kimia yang menjadi cadangan makanan bagi tumbuhan. Selain glukosa, fotosintesis juga menghasilkan oksigen yang dilepaskan ke udara dan digunakan untuk pernapasan makhluk hidup.
