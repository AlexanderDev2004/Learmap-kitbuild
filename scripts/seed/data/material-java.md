---
title: "Pemrograman Java"
description: "Bahan ajar Pemrograman Java dasar â€” pengertian, kompilasi, struktur program, dan variabel"
nodes:
    - id: "java"
      type: "text"
      position: { x: 620, y: 40 }
      data: { label: "Java", color: "green" }

    - id: "jvm"
      type: "text"
      position: { x: 260, y: 200 }
      data: { label: "JVM (Java Virtual Machine)" }

    - id: "bytecode"
      type: "text"
      position: { x: 420, y: 360 }
      data: { label: "Bytecode (.class)" }

    - id: "main-method"
      type: "text"
      position: { x: 660, y: 200 }
      data: { label: "Method main()" }

    - id: "source-code"
      type: "text"
      position: { x: 920, y: 200 }
      data: { label: "Source Code (.java)" }

    - id: "compiler"
      type: "text"
      position: { x: 1140, y: 280 }
      data: { label: "Compiler (javac)" }

    - id: "class"
      type: "text"
      position: { x: 840, y: 360 }
      data: { label: "Class" }

    - id: "objek"
      type: "text"
      position: { x: 1010, y: 520 }
      data: { label: "Objek" }

    - id: "method"
      type: "text"
      position: { x: 700, y: 520 }
      data: { label: "Method" }

    - id: "variabel"
      type: "text"
      position: { x: 500, y: 680 }
      data: { label: "Variabel" }

    - id: "tipe-data"
      type: "text"
      position: { x: 260, y: 760 }
      data: { label: "Tipe Data" }

    - id: "output"
      type: "text"
      position: { x: 830, y: 680 }
      data: { label: "System.out.println()" }

    - id: "library"
      type: "text"
      position: { x: 60, y: 200 }
      data: { label: "Library (API)" }

    - id: "c-berjalan"
      type: "connector"
      position: { x: 440, y: 120 }
      data: { label: "berjalan di atas" }

    - id: "c-eksekusi"
      type: "connector"
      position: { x: 340, y: 280 }
      data: { label: "mengeksekusi" }

    - id: "c-dikompilasi"
      type: "connector"
      position: { x: 1040, y: 200 }
      data: { label: "dikompilasi oleh" }

    - id: "c-berisi-sc"
      type: "connector"
      position: { x: 890, y: 280 }
      data: { label: "berisi" }

    - id: "c-entry"
      type: "connector"
      position: { x: 640, y: 120 }
      data: { label: "dieksekusi mulai dari" }

    - id: "c-berada"
      type: "connector"
      position: { x: 750, y: 280 }
      data: { label: "berada di dalam" }

    - id: "c-berisi-cl"
      type: "connector"
      position: { x: 770, y: 440 }
      data: { label: "berisi" }

    - id: "c-instansiasi"
      type: "connector"
      position: { x: 930, y: 440 }
      data: { label: "diinstansiasi menjadi" }

    - id: "c-gunakan"
      type: "connector"
      position: { x: 600, y: 600 }
      data: { label: "menggunakan" }

    - id: "c-miliki"
      type: "connector"
      position: { x: 380, y: 680 }
      data: { label: "memiliki" }

    - id: "c-output"
      type: "connector"
      position: { x: 770, y: 600 }
      data: { label: "mencetak output lewat" }

    - id: "c-sediakan"
      type: "connector"
      position: { x: 300, y: 120 }
      data: { label: "menyediakan" }

edges:
    - id: "e1"
      source: "java"
      target: "c-berjalan"
    - id: "e2"
      source: "c-berjalan"
      target: "jvm"
    - id: "e3"
      source: "jvm"
      target: "c-eksekusi"
    - id: "e4"
      source: "c-eksekusi"
      target: "bytecode"
    - id: "e5"
      source: "source-code"
      target: "c-dikompilasi"
    - id: "e6"
      source: "c-dikompilasi"
      target: "compiler"
    - id: "e7"
      source: "source-code"
      target: "c-berisi-sc"
    - id: "e8"
      source: "c-berisi-sc"
      target: "class"
    - id: "e9"
      source: "java"
      target: "c-entry"
    - id: "e10"
      source: "c-entry"
      target: "main-method"
    - id: "e11"
      source: "main-method"
      target: "c-berada"
    - id: "e12"
      source: "c-berada"
      target: "class"
    - id: "e13"
      source: "class"
      target: "c-berisi-cl"
    - id: "e14"
      source: "c-berisi-cl"
      target: "method"
    - id: "e15"
      source: "class"
      target: "c-instansiasi"
    - id: "e16"
      source: "c-instansiasi"
      target: "objek"
    - id: "e17"
      source: "method"
      target: "c-gunakan"
    - id: "e18"
      source: "c-gunakan"
      target: "variabel"
    - id: "e19"
      source: "variabel"
      target: "c-miliki"
    - id: "e20"
      source: "c-miliki"
      target: "tipe-data"
    - id: "e21"
      source: "java"
      target: "c-sediakan"
    - id: "e22"
      source: "c-sediakan"
      target: "library"
    - id: "e23"
      source: "method"
      target: "c-output"
    - id: "e24"
      source: "c-output"
      target: "output"
---

# Pemrograman Java

Java adalah bahasa pemrograman tingkat tinggi yang bersifat berorientasi objek dan dikembangkan oleh James Gosling bersama timnya di Sun Microsystems, kemudian dirilis secara resmi pada tahun 1995. Keunggulan utama Java terletak pada semboyan "Write Once, Run Anywhere": program yang ditulis sekali dapat dijalankan di berbagai sistem operasi. Hal ini dimungkinkan karena Java tidak berjalan langsung di atas sistem operasi, melainkan berjalan di atas JVM (Java Virtual Machine) yang bertugas menjalankan program Java pada platform mana pun.

Untuk menghasilkan program yang siap dijalankan, source code Java yang disimpan dalam berkas berekstensi .java harus terlebih dahulu dikompilasi. Proses kompilasi dilakukan oleh compiler bernama javac, dan hasil kompilasinya berupa bytecode yang disimpan dalam berkas berekstensi .class. Bytecode inilah yang kemudian dieksekusi oleh JVM, sehingga programmer tidak perlu menulis ulang programnya untuk setiap jenis komputer.

Secara struktur, setiap program Java minimal dibangun dari satu buah class, dan method main() merupakan pintu masuk eksekusi program yang berada di dalam class tersebut. Di dalam class juga dapat terdapat method-method lain sebagai wadah baris perintah, serta class dapat diinstansiasi menjadi objek yang mewakili konsep pemrograman berorientasi objek. Method dapat menggunakan variabel untuk menyimpan data yang sedang diproses.

Setiap variabel dalam Java memiliki tipe data tertentu, misalnya int untuk bilangan bulat atau String untuk teks, sehingga kompiler dapat memeriksa kecocokan data yang disimpan. Selain fitur bawaan bahasa, Java juga menyediakan library (API) yang kaya untuk membantu pembuatan antarmuka, jaringan, dan berbagai kebutuhan lain. Untuk menampilkan hasil ke layar, programmer umumnya memanfaatkan perintah System.out.println() di dalam method program.
