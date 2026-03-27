import React, { useState, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL

const FIELD_LABELS = {
  title: 'Título',
  journeyType: 'Tipo de jornada',
  speakers: 'Disertante/s',
  modality: 'Modalidad',
  place: 'Lugar',
  schedule: 'Horario',
  featuredProduct: 'Producto a destacar',
  brands: 'Marcas a incluir',
  topic: 'Tema / producto a destacar',
  slidesCount: 'Cantidad de placas',
  mandatoryTexts: 'Textos imprescindibles',
  product: 'Producto',
  keyFeatures: 'Características a destacar',
  price: 'Precio',
  validity: 'Vigencia de la oferta',
  format: 'Formato',
  estimatedDuration: 'Duración estimada',
  mainMessage: 'Mensaje principal',
  event: 'Evento / producto',
  date: 'Fecha',
  dimensions: 'Medidas',
  brand: 'Marca',
  highlightedContent: 'Contenido / producto a destacar',
  measure: 'Medida',
  content: 'Contenido a incluir',
  detailedRequest: 'Descripción detallada',
  message: 'Instrucción',
}

const getTaskPieceType = (task) => {
  if (task?.pieceType) {
    return task.pieceType
  }

  if (task?.formData?.pieceType) {
    return task.formData.pieceType
  }

  if (typeof task?.notes === 'string') {
    const match = task.notes.match(/Tipo de pieza:\s*(.+)/i)
    if (match?.[1]) {
      return match[1].split('\n')[0].trim()
    }
  }

  return 'Pedido'
}

function App() {
  const [tasks, setTasks] = useState([])
  const [fullName, setFullName] = useState('')
  const [area, setArea] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [pieceType, setPieceType] = useState('')
  const [channels, setChannels] = useState([])
  const [generalDescription, setGeneralDescription] = useState('')
  const [userAction, setUserAction] = useState('')
  const [additionalComments, setAdditionalComments] = useState('')
  const [files, setFiles] = useState([])
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [toast, setToast] = useState(false)
  const [flyerData, setFlyerData] = useState({
    title: '',
    journeyType: '',
    date: '',
    speakers: '',
    modality: '',
    place: '',
    schedule: '',
    featuredProduct: '',
    brands: ''
  })
  const [carruselData, setCarruselData] = useState({
    topic: '',
    slidesCount: '',
    mandatoryTexts: ''
  })
  const [promocionData, setPromocionData] = useState({
    product: '',
    keyFeatures: '',
    price: '',
    validity: ''
  })
  const [videoData, setVideoData] = useState({
    topic: '',
    format: '',
    estimatedDuration: '',
    mainMessage: ''
  })
  const [fotosData, setFotosData] = useState({
    event: '',
    date: '',
    place: ''
  })
  const [graficasStandData, setGraficasStandData] = useState({
    event: '',
    dimensions: '',
    brand: '',
    highlightedContent: ''
  })
  const [bannerData, setBannerData] = useState({
    measure: '',
    format: '',
    brand: '',
    content: ''
  })
  const [otroData, setOtroData] = useState({
    detailedRequest: ''
  })

  const addBusinessDays = (date, businessDays) => {
    const result = new Date(date)
    let daysAdded = 0
    while (daysAdded < businessDays) {
      result.setDate(result.getDate() + 1)
      const day = result.getDay()
      if (day !== 0 && day !== 6) {
        daysAdded += 1
      }
    }
    return result
  }

  const minDueDate = addBusinessDays(new Date(), 3).toISOString().split('T')[0]

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error al cargar tareas:', err)
      setTasks([])
    }
  }

  const uploadFile = async (file) => {
    const fileType = file.type || 'application/octet-stream'
    const res = await fetch(`${API_URL}/upload-url?filename=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(fileType)}`)
    const { uploadUrl, fileUrl } = await res.json()

    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': fileType },
      body: file
    })

    return fileUrl
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('La grabación de audio no es compatible con este navegador.')
      return
    }

    try {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
        setAudioPreviewUrl('')
      }
      setAudioBlob(null)
      setRecordingSeconds(0)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new window.MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: mimeType })
        setAudioBlob(blob)
        const nextUrl = URL.createObjectURL(blob)
        if (audioPreviewUrl) {
          URL.revokeObjectURL(audioPreviewUrl)
        }
        setAudioPreviewUrl(nextUrl)

        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
    } catch (err) {
      console.error('Error al iniciar grabación:', err)
      alert('No se pudo acceder al micrófono. Revisá los permisos del navegador.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    setRecording(false)
  }

  const clearRecording = () => {
    setAudioBlob(null)
    setRecordingSeconds(0)
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl)
      setAudioPreviewUrl('')
    }
  }

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleChannelChange = (channel) => {
    setChannels((prev) => {
      if (prev.includes(channel)) {
        return prev.filter((item) => item !== channel)
      }
      return [...prev, channel]
    })
  }

  const getConditionalDetails = () => {
    switch (pieceType) {
      case 'Flyer':
        return flyerData
      case 'Programa':
        return {
          message: 'Adjuntar documento con el programa completo del evento (temario, agenda, disertantes, etc.)'
        }
      case 'Carrusel':
        return carruselData
      case 'Promoción':
        return promocionData
      case 'Video':
        return videoData
      case 'Fotos':
        return fotosData
      case 'Gráficas Stand':
        return graficasStandData
      case 'Banner':
        return bannerData
      case 'Otro':
        return otroData
      default:
        return {}
    }
  }

  const formatNotes = () => {
    const lines = [
      'SECCIÓN 1 — Datos generales',
      `Área/Sector: ${area}`,
      `Fecha de entrega solicitada: ${dueDate}`,
      `Prioridad: ${priority}`,
      '',
      'SECCIÓN 2 — Tipo de pedido',
      `Tipo de pieza: ${pieceType}`,
      `Detalle condicional: ${JSON.stringify(getConditionalDetails(), null, 2)}`,
      '',
      'SECCIÓN 3 — Información base',
      `Canales: ${channels.join(', ')}`,
      `Descripción general: ${generalDescription}`,
      `Acción esperada del usuario: ${userAction}`
    ]

    if (additionalComments.trim()) {
      lines.push(`Comentarios adicionales: ${additionalComments}`)
    }

    return lines.join('\n')
  }

  const addTask = async () => {
    if (!fullName || !pieceType || !generalDescription || !userAction || !dueDate) {
      alert('Completá todos los campos obligatorios para continuar.')
      return
    }

    if (channels.length === 0) {
      alert('Seleccioná al menos un canal de publicación.')
      return
    }

    if (!files || files.length === 0) {
      alert('Adjuntá al menos un archivo para enviar el pedido.')
      return
    }

    if (dueDate < minDueDate) {
      alert('La fecha de entrega debe tener mínimo 3 días hábiles desde hoy.')
      return
    }

    const fileUrls = []
    if (files && files.length > 0) {
      for (let file of files) {
        const url = await uploadFile(file)
        fileUrls.push(url)
      }
    }

    let audioUrl = ''
    if (audioBlob) {
      const extension = audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
      const audioFile = new File([audioBlob], `nota-voz-${Date.now()}.${extension}`, {
        type: audioBlob.type || 'audio/webm'
      })
      audioUrl = await uploadFile(audioFile)
    }

    const summary = `${pieceType} - ${generalDescription.slice(0, 120)}`
    const conditionalData = getConditionalDetails()
    const formData = {
      fullName,
      area,
      dueDate,
      priority,
      pieceType,
      channels,
      generalDescription,
      userAction,
      additionalComments,
      conditionalData
    }

    const taskData = {
      description: summary,
      responsible: fullName,
      area,
      dueDate,
      priority,
      pieceType,
      channels,
      generalDescription,
      userAction,
      additionalComments,
      conditionalData,
      formData,
      notes: formatNotes(),
      completed: false,
      files: fileUrls,
      audio: audioUrl
    }

    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    })

    setFullName('')
    setArea('')
    setDueDate('')
    setPriority('Normal')
    setPieceType('')
    setChannels([])
    setGeneralDescription('')
    setUserAction('')
    setAdditionalComments('')
    setFiles([])
    clearRecording()
    setFlyerData({
      title: '',
      journeyType: '',
      date: '',
      speakers: '',
      modality: '',
      place: '',
      schedule: '',
      featuredProduct: '',
      brands: ''
    })
    setCarruselData({ topic: '', slidesCount: '', mandatoryTexts: '' })
    setPromocionData({ product: '', keyFeatures: '', price: '', validity: '' })
    setVideoData({ topic: '', format: '', estimatedDuration: '', mainMessage: '' })
    setFotosData({ event: '', date: '', place: '' })
    setGraficasStandData({ event: '', dimensions: '', brand: '', highlightedContent: '' })
    setBannerData({ measure: '', format: '', brand: '', content: '' })
    setOtroData({ detailedRequest: '' })

    fetchTasks()
    setToast(true)
    setTimeout(() => setToast(false), 4000)
  }

  const completeTask = async (id) => {
    await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true })
    })
    fetchTasks()
  }

  const cancelTask = async (id) => {
    await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canceled: true })
    })
    fetchTasks()
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    if (!recording) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1)
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [recording])

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
      }
    }
  }, [audioPreviewUrl])

  return (
    <div className="app-container">
      {toast && (
        <div className="toast-success" role="status">
          ✓ El pedido fue creado con éxito
        </div>
      )}
      <header className="app-header">
        <div className="title-wrap">
          <img src="/logo.png" alt="TaskMaster Logo" className="logo" />
          <h1>Pedido de piezas de diseño / contenido</h1>
        </div>
      </header>

      <form className="task-form" onSubmit={(e) => { e.preventDefault(); addTask(); }}>
        <h2>SECCIÓN 1 — Datos generales</h2>

        <label htmlFor="fullName">1. Nombre y apellido</label>
        <input
          type="text"
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <label htmlFor="area">2. Área / sector</label>
        <input
          type="text"
          id="area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          required
        />

        <label htmlFor="dueDate">3. Fecha de entrega solicitada</label>
        <input
          type="date"
          id="dueDate"
          className="delivery-date-input"
          value={dueDate}
          min={minDueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
        <small>Mínimo 3 días hábiles desde hoy.</small>

        <fieldset>
          <legend>4. Prioridad</legend>
          <label className="inline-option">
            <input
              type="radio"
              name="priority"
              checked={priority === 'Normal'}
              onChange={() => setPriority('Normal')}
            />
            Normal
          </label>
          <label className="inline-option">
            <input
              type="radio"
              name="priority"
              checked={priority === 'Urgente'}
              onChange={() => setPriority('Urgente')}
            />
            Urgente
          </label>
        </fieldset>

        <h2>SECCIÓN 2 — Tipo de pedido</h2>

        <label htmlFor="pieceType">5. Tipo de pieza</label>
        <select
          id="pieceType"
          value={pieceType}
          onChange={(e) => setPieceType(e.target.value)}
          required
        >
          <option value="">Seleccionar tipo</option>
          <option value="Flyer">Flyer</option>
          <option value="Programa">Programa</option>
          <option value="Carrusel">Carrusel</option>
          <option value="Promoción">Promoción</option>
          <option value="Video">Video</option>
          <option value="Fotos">Fotos</option>
          <option value="Gráficas Stand">Gráficas Stand</option>
          <option value="Banner">Banner</option>
          <option value="Otro">Otro</option>
        </select>

        {pieceType === 'Flyer' && (
          <div className="conditional-section">
            <h3>Campos para Flyer</h3>
            <input
              type="text"
              placeholder="Título"
              value={flyerData.title}
              onChange={(e) => setFlyerData({ ...flyerData, title: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Tipo de jornada"
              value={flyerData.journeyType}
              onChange={(e) => setFlyerData({ ...flyerData, journeyType: e.target.value })}
              required
            />
            <input
              type="date"
              value={flyerData.date}
              onChange={(e) => setFlyerData({ ...flyerData, date: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Disertante/s"
              value={flyerData.speakers}
              onChange={(e) => setFlyerData({ ...flyerData, speakers: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Modalidad (presencial/online)"
              value={flyerData.modality}
              onChange={(e) => setFlyerData({ ...flyerData, modality: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Lugar"
              value={flyerData.place}
              onChange={(e) => setFlyerData({ ...flyerData, place: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Horario"
              value={flyerData.schedule}
              onChange={(e) => setFlyerData({ ...flyerData, schedule: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Producto a destacar (opcional)"
              value={flyerData.featuredProduct}
              onChange={(e) => setFlyerData({ ...flyerData, featuredProduct: e.target.value })}
            />
            <input
              type="text"
              placeholder="Marcas a incluir (opcional)"
              value={flyerData.brands}
              onChange={(e) => setFlyerData({ ...flyerData, brands: e.target.value })}
            />
          </div>
        )}

        {pieceType === 'Programa' && (
          <div className="conditional-section">
            <h3>Campos para Programa</h3>
            <p>Adjuntar documento con el programa completo del evento (temario, agenda, disertantes, etc.)</p>
          </div>
        )}

        {pieceType === 'Carrusel' && (
          <div className="conditional-section">
            <h3>Campos para Carrusel</h3>
            <input
              type="text"
              placeholder="Tema / producto a destacar"
              value={carruselData.topic}
              onChange={(e) => setCarruselData({ ...carruselData, topic: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Cantidad de placas"
              min="1"
              value={carruselData.slidesCount}
              onChange={(e) => setCarruselData({ ...carruselData, slidesCount: e.target.value })}
              required
            />
            <textarea
              placeholder="Textos imprescindibles"
              value={carruselData.mandatoryTexts}
              onChange={(e) => setCarruselData({ ...carruselData, mandatoryTexts: e.target.value })}
              required
            />
            <small>Recordatorio: adjuntar imágenes necesarias.</small>
          </div>
        )}

        {pieceType === 'Promoción' && (
          <div className="conditional-section">
            <h3>Campos para Promoción</h3>
            <input
              type="text"
              placeholder="Producto"
              value={promocionData.product}
              onChange={(e) => setPromocionData({ ...promocionData, product: e.target.value })}
              required
            />
            <textarea
              placeholder="Características a destacar"
              value={promocionData.keyFeatures}
              onChange={(e) => setPromocionData({ ...promocionData, keyFeatures: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Precio"
              value={promocionData.price}
              onChange={(e) => setPromocionData({ ...promocionData, price: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Vigencia de la oferta"
              value={promocionData.validity}
              onChange={(e) => setPromocionData({ ...promocionData, validity: e.target.value })}
              required
            />
            <small>Recordatorio: adjuntar imágenes del producto.</small>
          </div>
        )}

        {pieceType === 'Video' && (
          <div className="conditional-section">
            <h3>Campos para Video</h3>
            <input
              type="text"
              placeholder="Temática / producto / evento"
              value={videoData.topic}
              onChange={(e) => setVideoData({ ...videoData, topic: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Formato (reel, historia, horizontal)"
              value={videoData.format}
              onChange={(e) => setVideoData({ ...videoData, format: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Duración estimada"
              value={videoData.estimatedDuration}
              onChange={(e) => setVideoData({ ...videoData, estimatedDuration: e.target.value })}
              required
            />
            <textarea
              placeholder="Mensaje principal"
              value={videoData.mainMessage}
              onChange={(e) => setVideoData({ ...videoData, mainMessage: e.target.value })}
              required
            />
            <small>Recordatorio: adjuntar material audiovisual.</small>
          </div>
        )}

        {pieceType === 'Fotos' && (
          <div className="conditional-section">
            <h3>Campos para Fotos</h3>
            <input
              type="text"
              placeholder="Evento / producto"
              value={fotosData.event}
              onChange={(e) => setFotosData({ ...fotosData, event: e.target.value })}
              required
            />
            <input
              type="date"
              value={fotosData.date}
              onChange={(e) => setFotosData({ ...fotosData, date: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Lugar"
              value={fotosData.place}
              onChange={(e) => setFotosData({ ...fotosData, place: e.target.value })}
              required
            />
          </div>
        )}

        {pieceType === 'Gráficas Stand' && (
          <div className="conditional-section">
            <h3>Campos para Gráficas Stand</h3>
            <input
              type="text"
              placeholder="Evento"
              value={graficasStandData.event}
              onChange={(e) => setGraficasStandData({ ...graficasStandData, event: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Medidas"
              value={graficasStandData.dimensions}
              onChange={(e) => setGraficasStandData({ ...graficasStandData, dimensions: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Marca"
              value={graficasStandData.brand}
              onChange={(e) => setGraficasStandData({ ...graficasStandData, brand: e.target.value })}
              required
            />
            <textarea
              placeholder="Contenido / producto a destacar"
              value={graficasStandData.highlightedContent}
              onChange={(e) => setGraficasStandData({ ...graficasStandData, highlightedContent: e.target.value })}
              required
            />
            <small>Si son varias gráficas, adjuntar un documento detallando cada una + manual/lineamientos de stand de ser necesario.</small>
          </div>
        )}

        {pieceType === 'Banner' && (
          <div className="conditional-section">
            <h3>Campos para Banner</h3>
            <input
              type="text"
              placeholder="Medida"
              value={bannerData.measure}
              onChange={(e) => setBannerData({ ...bannerData, measure: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Formato (PDF, JPEG, PNG, AI, SVG)"
              value={bannerData.format}
              onChange={(e) => setBannerData({ ...bannerData, format: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Marca"
              value={bannerData.brand}
              onChange={(e) => setBannerData({ ...bannerData, brand: e.target.value })}
              required
            />
            <textarea
              placeholder="Contenido a incluir"
              value={bannerData.content}
              onChange={(e) => setBannerData({ ...bannerData, content: e.target.value })}
              required
            />
          </div>
        )}

        {pieceType === 'Otro' && (
          <div className="conditional-section">
            <h3>Campos para Otro</h3>
            <textarea
              placeholder="Descripción detallada del pedido (tipo de pieza, formato, medidas, marcas, productos y objetivo)"
              value={otroData.detailedRequest}
              onChange={(e) => setOtroData({ detailedRequest: e.target.value })}
              required
            />
          </div>
        )}

        <h2>SECCIÓN 3 — Información base</h2>

        <fieldset>
          <legend>6. Canal donde se va a publicar</legend>
          {['Instagram', 'WhatsApp', 'Email', 'Web', 'Impreso', 'Otro'].map((channel) => (
            <label key={channel} className="inline-option">
              <input
                type="checkbox"
                checked={channels.includes(channel)}
                onChange={() => handleChannelChange(channel)}
              />
              {channel}
            </label>
          ))}
        </fieldset>

        <label htmlFor="generalDescription">7. Descripción general del pedido</label>
        <textarea
          id="generalDescription"
          value={generalDescription}
          onChange={(e) => setGeneralDescription(e.target.value)}
          required
        />

        <label htmlFor="userAction">8. ¿Qué acción querés que haga el usuario al ver esta pieza?</label>
        <textarea
          id="userAction"
          value={userAction}
          onChange={(e) => setUserAction(e.target.value)}
          placeholder="Ej: inscribirse, comprar, consultar"
          required
        />

        <label htmlFor="files">9. Archivos adjuntos</label>
        <input
          type="file"
          id="files"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files))}
          required
        />

        <label>Mensaje de voz (o)pcional)</label>
        <div className="audio-recorder">
          {!recording && (
            <button type="button" onClick={startRecording}>Grabar audio</button>
          )}
          {recording && (
            <>
              <button type="button" onClick={stopRecording}>Detener</button>
              <span className="recording-status">Grabando: {formatRecordingTime(recordingSeconds)}</span>
            </>
          )}
          {audioPreviewUrl && (
            <>
              <audio controls src={audioPreviewUrl} />
              <button type="button" className="secondary-btn" onClick={clearRecording}>Eliminar audio</button>
            </>
          )}
        </div>
        <small>Asegurate que la grabación sea correcta.</small>

        <label htmlFor="additionalComments">10. Comentarios adicionales (opcional)</label>
        <textarea
          id="additionalComments"
          value={additionalComments}
          onChange={(e) => setAdditionalComments(e.target.value)}
        />

        <div style={{ marginTop: 8 }}>
          <button type="submit">Enviar pedido</button>
        </div>
      </form>

      {tasks.length > 0 && (
        <section className="tasks-section">
          <h2 className="tasks-section-title">Pedidos enviados</h2>
          <ul className="task-list">
            {tasks.map(task => {
              const taskPieceType = getTaskPieceType(task)
              const conditionalData = task.conditionalData && typeof task.conditionalData === 'object'
                ? task.conditionalData : {}
              const channels = Array.isArray(task.channels) ? task.channels : []
              const fileUrls = Array.isArray(task.files) ? task.files : []
              const audioUrl = task.audio && !fileUrls.includes(task.audio) ? task.audio : null

              const images = fileUrls.filter(u => u.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i))
              const audios = fileUrls.filter(u => u.match(/\.(mp3|wav|ogg|webm|m4a)(\?|$)/i))
              const otherFiles = fileUrls.filter(u =>
                !u.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) &&
                !u.match(/\.(mp3|wav|ogg|webm|m4a)(\?|$)/i)
              )

              return (
                <li key={task.id} className={`task-card${task.completed ? ' tc-done' : ''}${task.canceled ? ' tc-cancelled' : ''}`}>

                  {/* ── Header ── */}
                  <div className="tc-header">
                    <span className="tc-piece-type">{taskPieceType}</span>
                    <span className={`tc-priority tc-priority-${(task.priority || 'normal').toLowerCase().replace(/\s+/g, '-')}`}>
                      {task.priority || 'Normal'}
                    </span>
                    {task.completed && <span className="tc-status tc-status-done">✓ Completada</span>}
                    {task.canceled && <span className="tc-status tc-status-cancelled">✕ Cancelada</span>}
                  </div>

                  {/* ── Info base ── */}
                  <div className="tc-body">
                    <div className="tc-row">
                      <span className="tc-label">Tipo de pieza</span>
                      <span className="tc-value">{taskPieceType}</span>
                    </div>
                    {task.responsible && (
                      <div className="tc-row">
                        <span className="tc-label">Solicitante</span>
                        <span className="tc-value">{task.responsible}</span>
                      </div>
                    )}
                    {task.area && (
                      <div className="tc-row">
                        <span className="tc-label">Área / Sector</span>
                        <span className="tc-value">{task.area}</span>
                      </div>
                    )}
                    {(task.dueDate || task.due_date) && (
                      <div className="tc-row">
                        <span className="tc-label">Fecha solicitada</span>
                        <span className="tc-value">{task.dueDate || task.due_date}</span>
                      </div>
                    )}
                    {channels.length > 0 && (
                      <div className="tc-row">
                        <span className="tc-label">Canales</span>
                        <span className="tc-chips">
                          {channels.map(c => <span key={c} className="tc-chip">{c}</span>)}
                        </span>
                      </div>
                    )}

                    {/* ── Datos condicionales ── */}
                    {Object.entries(conditionalData).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="tc-row">
                        <span className="tc-label">{FIELD_LABELS[k] || k}</span>
                        <span className="tc-value">{String(v)}</span>
                      </div>
                    ))}

                    {/* ── Descripción e instrucciones ── */}
                    {task.generalDescription && (
                      <div className="tc-row tc-row-block">
                        <span className="tc-label">Descripción del pedido</span>
                        <span className="tc-value">{task.generalDescription}</span>
                      </div>
                    )}
                    {task.userAction && (
                      <div className="tc-row tc-row-block">
                        <span className="tc-label">Acción esperada del usuario</span>
                        <span className="tc-value">{task.userAction}</span>
                      </div>
                    )}
                    {task.additionalComments && (
                      <div className="tc-row tc-row-block">
                        <span className="tc-label">Comentarios adicionales</span>
                        <span className="tc-value">{task.additionalComments}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Imágenes ── */}
                  {images.length > 0 && (
                    <div className="tc-files">
                      <span className="tc-files-label">Imágenes adjuntas</span>
                      <div className="tc-images">
                        {images.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Imagen ${idx + 1}`} className="tc-thumb" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Audio ── */}
                  {(audios.length > 0 || audioUrl) && (
                    <div className="tc-files">
                      <span className="tc-files-label">Nota de voz</span>
                      {audios.map((url, idx) => (
                        <audio key={idx} src={url} controls className="tc-audio" />
                      ))}
                      {audioUrl && <audio src={audioUrl} controls className="tc-audio" />}
                    </div>
                  )}

                  {/* ── Otros archivos ── */}
                  {otherFiles.length > 0 && (
                    <div className="tc-files">
                      <span className="tc-files-label">Otros archivos</span>
                      {otherFiles.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="tc-file-link">
                          📄 Archivo {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* ── Acciones ── */}
                  {!(task.completed || task.canceled) && (
                    <div className="tc-actions">
                      <button className="tc-btn tc-btn-complete" onClick={() => completeTask(task.id)}>Completar</button>
                      <button className="tc-btn tc-btn-cancel" onClick={() => cancelTask(task.id)}>Cancelar</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

export default App
