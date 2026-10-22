import type { Dictionary } from "./en";

/**
 * Indonesian strings. Indonesian doesn't inflect for number, so each count's
 * two forms are the same.
 */
export const id: Dictionary = {
  meta: {
    localeTag: "id",
    name: "Bahasa Indonesia",
  },

  app: {
    back: "Kembali",
    languageLabel: "Bahasa",
    themeLabel: "Tampilan",
    copyright: "© {years} Eusebius Ngemera",
    licence: "GPLv3",
    licenceTitle: "Lisensi Publik Umum GNU, versi 3 atau yang lebih baru",
    notAffiliated: "Tidak berafiliasi dengan YouVersion.",
  },

  themes: {
    system: "Sistem",
    light: "Terang",
    dark: "Gelap",
  },

  signIn: {
    intro:
      "Tandai ayat di satu versi Alkitab, dan tanda itu muncul di versi lain yang Anda baca. Nomor ayat dicocokkan meskipun versinya berbeda (judul Mazmur, Yoel, Maleakhi, Ayub, dan lainnya).",
    points: [
      "Pada sinkronisasi pertama, tanda yang sudah ada tidak pernah diganti warnanya atau dihapus.",
      "Tinjau setiap perubahan sebelum apa pun ditulis.",
      "Info masuk dan data Anda tetap di peramban ini dan hanya dikirim ke YouVersion.",
    ],
    button: "Masuk dengan YouVersion",
    opening: "Membuka YouVersion…",
    disclaimer: "Menggunakan API YouVersion Platform dengan izin Anda.",
    missingKey: "Kunci aplikasi tidak ada. Isi VITE_YV_APP_KEY di apps/pwa/.env.local lalu mulai ulang.",
  },

  callback: {
    finishing: "Menyelesaikan proses masuk…",
    failed: "Proses masuk tidak selesai",
    stateMismatch: "Proses masuk ini tidak cocok dengan yang dimulai aplikasi, atau terlalu lama. Silakan masuk lagi.",
    noPermission:
      "Anda sudah masuk tetapi tidak mengizinkan akses ke tanda ayat, yang dibutuhkan aplikasi ini. Silakan masuk lagi dan izinkan.",
    provider: "YouVersion melaporkan masalah: {detail}",
  },

  priority: {
    title: "Jika warna sebuah ayat berbeda, mana yang dipakai?",
    toggle: "Gunakan prioritas warna, bukan prioritas versi",
    byVersion: "Prioritas versi",
    byColor: "Prioritas warna",
    helpByVersion: "Setiap versi mempertahankan warnanya sendiri. Versi tanpa tanda mendapat warna dari versi yang paling atas.",
    helpByColor: "Setiap versi mempertahankan warnanya sendiri. Versi tanpa tanda mendapat warna yang paling atas, di versi mana pun warna itu berada; di antara dua versi dengan warna yang sama, urutan versi yang menentukan.",
    note: "bible.com hanya menyediakan kuning, hijau, biru, persik, dan merah muda; warna lainnya dari aplikasi seluler.",
    drag: "Ubah urutan {color}: seret, atau gunakan tombol panah atas dan bawah",
    names: {
      purple: "Ungu",
      aqua: "Biru muda",
      yellow: "Kuning",
      green: "Hijau",
      blue: "Biru",
      peach: "Persik",
      pink: "Merah muda",
      paleYellow: "Kuning pucat",
      orange: "Oranye",
      grey: "Abu-abu",
    },
  },

  versions: {
    title: "Versi Anda",
    help: "Versi tempat Anda menandai ayat. Ayat dicocokkan meskipun penomorannya berbeda.",
    source: {
      verified: {
        text: "Penomoran terverifikasi",
        hint: "Penomoran ayat versi ini diperiksa pasal demi pasal.",
      },
      scanned: {
        text: "Jumlah ayat diketahui",
        hint: "Jumlah ayat versi ini disertakan dalam aplikasi (dipindai dari bible.com, Sept. 2026), tetapi penomorannya belum diperiksa secara manual. Pasal yang tidak mengikuti sistem standar mana pun dilewati.",
      },
      "api-index": {
        text: "Penomoran dari YouVersion",
        hint: "Jumlah ayat berasal dari API YouVersion. Pasal yang tidak mengikuti sistem standar mana pun dilewati.",
      },
      assumed: {
        text: "Penomoran diasumsikan",
        hint: "Jumlah ayat versi ini tidak dapat dibaca, jadi penomoran {system} diasumsikan. Tanda di Mazmur dan beberapa pasal Perjanjian Lama bisa jatuh di ayat yang salah.",
      },
      unsupported: {
        text: "Penomoran tidak didukung",
        hint: "{n} pasal dalam versi ini tidak cocok dengan penomoran Inggris maupun Ibrani, dan YouVersion tidak menyebutkan sistem yang dipakainya (Sinodal Rusia, Septuaginta…), jadi tanda akan jatuh di ayat yang salah. Versi ini tidak diikutkan dalam sinkronisasi, dan tandanya tidak disentuh.",
      },
    },
    systems: {
      eng: "Inggris",
      org: "Ibrani",
      rso: "Sinodal Rusia",
      rsc: "Sinodal Rusia",
      lxx: "Septuaginta",
      vul: "Vulgata",
    },
    checking: "Memeriksa penomoran…",
    unnamed: "Versi {id}",
    drag: "Ubah urutan {abbr}: seret, atau gunakan tombol panah atas dan bawah",
    remove: "Hapus {abbr}",
    confirmRemove: "Berhenti menyinkronkan {abbr}? Tandanya tetap ada di YouVersion.",
    addLabel: "Tambah versi",
    addPlaceholder: "Cari berdasarkan nama, singkatan, atau nomor",
    add: "Tambah",
    adding: "Memeriksa…",
    addHelp: "Bahasa Anda muncul lebih dulu. Anda juga bisa menempelkan tautan dari bible.com, seperti",
    alreadyAdded: "Sudah ditambahkan",
    number: "No. {id}",
    moreResults: "Menampilkan {shown} dari {total}. Ketik lebih lanjut untuk mempersempit.",
    noResults: "Tidak ada versi yang cocok dengan “{query}”.",
    find: {
      examples: "Ini contoh versi. Biarkan aplikasi menemukan versi tempat Anda menandai ayat, atau tambahkan sendiri di bawah.",
      button: "Temukan versi saya",
      again: "Cari lagi",
      help: "Memeriksa tanda Anda di beberapa pasal terkenal dari setiap versi dalam bahasa Anda. Tidak ada yang diubah.",
      starting: "Memulai…",
      progress: "Mencari tanda Anda · {done} dari {total}",
      stop: "Hentikan",
      stopping: "Menghentikan…",
      stoppingButton: "Menghentikan",
      stopped: "Dihentikan setelah memeriksa {done} dari {total}.",
      stoppedAtStart: "Dihentikan sebelum ada yang diperiksa.",
      failed: "Pencarian tidak dapat diselesaikan: {problem}",
      none: "Tidak ada tanda di pasal yang diperiksa (Yesaya 41, Filipi 4, Yohanes 3). Tambahkan versi Anda di bawah.",
      foundTitle: "Anda menandai di",
      verses: ["{n} ayat bertanda dalam sampel", "{n} ayat bertanda dalam sampel"],
      unsupported: "Penomoran tidak didukung, jadi tidak dapat disinkronkan",
      inList: "Di daftar Anda",
      add: "Tambah {abbr}",
      notFound: "Tidak ada tanda di {list} pada pasal yang diperiksa.",
      useThese: ["Gunakan versi ini", "Gunakan {n} versi ini saja"],
    },
    errors: {
      cantRead: "Tanda untuk versi {id} tidak dapat dibaca: {problem}",
      unsupported:
        "Versi {id} tidak dapat disinkronkan: {n} pasalnya tidak cocok dengan penomoran Inggris maupun Ibrani, dan YouVersion tidak menyebutkan sistem yang dipakainya, jadi tanda akan jatuh di ayat yang salah.",
    },
  },

  sync: {
    title: "Sinkronkan",
    scopeLegend: "Yang disinkronkan",
    chapter: "Pasal",
    book: "Kitab",
    bible: "Seluruh Alkitab",
    chapterCount: ["{book} memiliki {n} pasal di {abbr}.", "{book} memiliki {n} pasal di {abbr}."],
    estimate: ["Membaca {n} pasal, sekitar {time}. Biarkan halaman ini tetap terbuka.", "Membaca {n} pasal, sekitar {time}. Biarkan halaman ini tetap terbuka."],
    preview: "Pratinjau perubahan",
    syncNow: "Sinkronkan sekarang",
    confirmBible: "Sinkronkan seluruh Alkitab sekarang, tanpa pratinjau?",
    previewing: "Meninjau",
    syncing: "Menyinkronkan",
    starting: "Memulai…",
    reading: "Membaca {book}",
    remaining: "sisa sekitar {time}",
    remainingRange: "sisa {time}",
    writing: "Menulis {book}",
    stop: "Hentikan",
    stopping: "Menghentikan…",
    stoppingWriting: "Berhenti setelah {book} selesai ditulis…",
    stoppingButton: "Menghentikan",
    stopNote: "Jika dihentikan sekarang, kitab yang sedang ditulis diselesaikan dulu, supaya tidak ada yang setengah jadi.",
    tooFew: "Sinkronisasi membutuhkan setidaknya dua versi dengan penomoran yang didukung.",
    resumePreview: "Pratinjau berikutnya dilanjutkan dari {book}, tempat pratinjau terakhir berhenti.",
    resumeSync: "Sinkronisasi berikutnya dilanjutkan dari {book}, tempat sinkronisasi terakhir berhenti.",
    startOver: "Mulai dari awal",
  },

  results: {
    previewTitle: "Pratinjau",
    doneTitle: "Sinkronisasi selesai",
    stopped: "(dihentikan)",
    inSyncDone: "Semuanya sudah sinkron.",
    inSyncPreview: "Tidak ada yang perlu diubah — semuanya sudah sinkron.",
    inSyncStoppedDone: [
      "Tidak ada yang perlu diubah di kitab yang disinkronkan sebelum dihentikan.",
      "Tidak ada yang perlu diubah di {n} kitab yang disinkronkan sebelum dihentikan.",
    ],
    inSyncStoppedPreview: [
      "Tidak ada yang perlu diubah di kitab yang dibaca sebelum dihentikan.",
      "Tidak ada yang perlu diubah di {n} kitab yang dibaca sebelum dihentikan.",
    ],
    stoppedBeforeBook: "Dihentikan sebelum satu kitab selesai dibaca, jadi tidak ada yang bisa ditampilkan. Tidak ada yang diubah.",
    added: ["{n} tanda ditambahkan", "{n} tanda ditambahkan"],
    removedCount: ["{n} dihapus", "{n} dihapus"],
    toAdd: ["{n} tanda akan ditambahkan", "{n} tanda akan ditambahkan"],
    toRemove: ["{n} akan dihapus", "{n} akan dihapus"],
    differences: [
      "{n} ayat memiliki warna berbeda; setiap versi mempertahankan warnanya sendiri.",
      "{n} ayat memiliki warna berbeda; setiap versi mempertahankan warnanya sendiri.",
    ],
    booksSkipped: [
      "{n} kitab dilewati karena tandanya tidak dapat dibaca. Tidak ada yang diubah di dalamnya.",
      "{n} kitab dilewati karena tandanya tidak dapat dibaca. Tidak ada yang diubah di dalamnya.",
    ],
    writeErrors: ["{n} perubahan gagal; sinkronisasi berikutnya akan mencobanya lagi.", "{n} perubahan gagal; sinkronisasi berikutnya akan mencobanya lagi."],
    authExpired: "Dihentikan: sesi YouVersion Anda telah berakhir. Tidak ada lagi yang diubah.",
    network:
      "Dihentikan: YouVersion tidak menjawab. Periksa koneksi Anda. Jika Anda sedang daring, aplikasi kemungkinan terlalu sering meminta untuk saat ini: YouVersion lalu membuatnya menunggu beberapa menit. Tidak ada lagi yang diubah.",
    rateLimited: [
      "Dihentikan: YouVersion menerima terlalu banyak permintaan dari aplikasi untuk saat ini. Coba lagi dalam {n} menit. Tidak ada lagi yang diubah.",
      "Dihentikan: YouVersion menerima terlalu banyak permintaan dari aplikasi untuk saat ini. Coba lagi dalam {n} menit. Tidak ada lagi yang diubah.",
    ],
    rateLimitedSoon: "Dihentikan: YouVersion menerima terlalu banyak permintaan dari aplikasi untuk saat ini. Coba lagi dalam beberapa menit. Tidak ada lagi yang diubah.",
    signInAgain: "Masuk lagi",
    apply: ["Terapkan {n} perubahan", "Terapkan {n} perubahan"],
    blocked: [
      "{n} kitab tidak diubah karena sinkronisasi akan menghapus banyak tanda sekaligus. Jika Anda memang ingin menghapusnya, lanjutkan:",
      "{n} kitab tidak diubah karena sinkronisasi akan menghapus banyak tanda sekaligus. Jika Anda memang ingin menghapusnya, lanjutkan:",
    ],
    applyWithRemovals: "Terapkan, termasuk penghapusan",
    skippedRead: "dilewati: tidak dapat dibaca",
    notApplied: "tidak diterapkan: akan menghapus {removals} tanda (batas {limit} per kali)",
    differentColors: "Warna berbeda",
    differenceNote: "Masing-masing mempertahankan warnanya; versi tanpa tanda mendapat warna dari {winner}.",
    removed: "dihapus",
    action: { fill: "tambah", recolor: "ganti warna", remove: "hapus" },
    more: "…dan {n} lainnya",
    refused: "Tidak diikutkan karena penomorannya tidak didukung: {names}. Tidak ada yang dibaca atau diubah di dalamnya.",
  },

  problems: {
    signInExpired: "sesi YouVersion Anda telah berakhir. Silakan masuk lagi.",
    unreachable:
      "YouVersion tidak menjawab. Periksa koneksi Anda. Jika Anda sedang daring, aplikasi kemungkinan terlalu sering meminta untuk saat ini: YouVersion lalu membuatnya menunggu beberapa menit.",
    rateLimited: [
      "YouVersion menerima terlalu banyak permintaan dari aplikasi untuk saat ini. Coba lagi dalam {n} menit.",
      "YouVersion menerima terlalu banyak permintaan dari aplikasi untuk saat ini. Coba lagi dalam {n} menit.",
    ],
    rateLimitedSoon: "YouVersion menerima terlalu banyak permintaan dari aplikasi untuk saat ini. Coba lagi dalam beberapa menit.",
  },

  stats: {
    title: "Tanda Anda",
    note: "Dari memori sinkronisasi di peramban ini: setiap pasal seperti setelah sinkronisasi terakhirnya, bukan seperti di YouVersion sekarang.",
    empty: "Belum ada yang disinkronkan. Statistik akan muncul di sini setelah sinkronisasi pertama Anda.",
    demo: "Data karangan untuk pengembangan; tidak ada yang disimpan.",
    verses: ["ayat ditandai", "ayat ditandai"],
    chapters: "pasal disinkronkan",
    chaptersOf: "dari {total} ({percent})",
    versions: ["versi", "versi"],
    perVersion: "Per versi",
    highlights: ["{n} tanda", "{n} tanda"],
    added: ["{n} ditambahkan oleh sinkronisasi", "{n} ditambahkan oleh sinkronisasi"],
    unwritable: ["{n} ayat ditolak YouVersion", "{n} ayat ditolak YouVersion"],
    colorCount: "{color}: {n}",
    overlap: "Antarversi",
    everywhere: "Di semua versi",
    some: "Di beberapa",
    one: "Hanya di satu",
    differing: [
      "{n} ayat memiliki warna berbeda di versi yang berbeda.",
      "{n} ayat memiliki warna berbeda di versi yang berbeda.",
    ],
    byBook: "Per kitab",
    bookRow: [
      "{book}: {n} ayat ditandai, {synced} dari {chapters} pasal disinkronkan",
      "{book}: {n} ayat ditandai, {synced} dari {chapters} pasal disinkronkan",
    ],
    topChapters: "Pasal yang paling banyak ditandai",
    topShare: "Pasal dengan bagian tertanda terbesar",
    versesOf: "{n} dari {total} ayat",
    pace: "Kecepatan",
    perRead: "{ms} md untuk membaca satu pasal",
    perWrite: "{ms} md untuk menulis satu tanda",
    noPace: "Belum diukur: diukur saat pratinjau atau sinkronisasi.",
  },

  footer: {
    memory: ["Memori sinkronisasi: {n} ayat", "Memori sinkronisasi: {n} ayat"],
    stats: "Statistik",
    reset: "Atur ulang",
    confirmReset:
      "Lupakan apa yang dilakukan sinkronisasi sebelumnya? Sinkronisasi berikutnya hanya akan mengisi yang kosong; tidak akan menghapus atau mengganti warna apa pun.",
    signOut: "Keluar",
  },
};
