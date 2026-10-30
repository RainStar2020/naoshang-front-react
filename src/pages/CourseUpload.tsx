import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import PageHeader from '../components/PageHeader'
import RichEditor from '../components/RichEditor'
import ImageUpload from '../components/ImageUpload'
import FileList, { type FileItem, makeFileItem } from '../components/FileList'
import Modal from '../components/Modal'
import { ToastHost, useToast } from '../components/Toast'
import { countMedia, fileToBase64, formatSize, htmlTextLength } from '../utils/file'

const categories = ['职业技能', '兴趣爱好', '考试考证', '亲子教育', '职场提升']

export default function CourseUpload() {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [tags, setTags] = useState('')
  const [intro, setIntro] = useState('')
  const [cover, setCover] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [lessons, setLessons] = useState<FileItem[]>([])
  const [attachments, setAttachments] = useState<FileItem[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const { toasts, push } = useToast()

  const textLen = useMemo(() => htmlTextLength(bodyHtml), [bodyHtml])
  const imgCount = useMemo(() => countMedia(bodyHtml, 'img'), [bodyHtml])
  const videoCount = useMemo(() => countMedia(bodyHtml, 'video'), [bodyHtml])

  const addFiles = (setter: Dispatch<SetStateAction<FileItem[]>>) => (files: FileList) => {
    Array.from(files).forEach(async (file) => {
      const url = file.type.startsWith('image/') || file.type.startsWith('video/')
        ? URL.createObjectURL(file)
        : await fileToBase64(file)
      setter((prev) => [...prev, makeFileItem(file, url)])
    })
  }

  const removeFile = (setter: Dispatch<SetStateAction<FileItem[]>>) => (id: string) => {
    setter((prev) => prev.filter((f) => f.id !== id))
  }

  const validate = (): string | null => {
    if (!title.trim()) return '请填写课程标题'
    if (!cover) return '请上传课程封面图'
    if (textLen === 0 && imgCount === 0 && videoCount === 0) return '请在正文中输入文字或插入图片 / 视频'
    return null
  }

  const handleDraft = () => {
    push('草稿已保存（Demo 仅本地预览，未上传服务器）', 'info')
  }

  const handlePublish = () => {
    const err = validate()
    if (err) {
      push(err, 'error')
      return
    }
    setShowSuccess(true)
  }

  const handleReset = () => {
    setTitle('')
    setCategory(categories[0])
    setTags('')
    setIntro('')
    setCover('')
    setBodyHtml('')
    setLessons([])
    setAttachments([])
    setShowSuccess(false)
    push('课程已发布成功', 'success')
  }

  return (
    <div>
      <ToastHost toasts={toasts} />
      <PageHeader
        title="上传课程"
        description="填写课程基础信息，通过富文本编辑器编写图文视频混排的课程正文，支持课时视频与资料附件上传。"
        actions={
          <>
            <button className="btn btn-ghost" onClick={handleDraft}>保存草稿</button>
            <button className="btn btn-primary" onClick={handlePublish}>发布课程</button>
          </>
        }
      />

      <div className="course-layout">
        <div>
          {/* 基本信息 */}
          <div className="card">
            <h3 className="card-title">基本信息</h3>
            <div className="form-grid-2">
              <div>
                <div className="form-item">
                  <label className="form-label"><span className="required">*</span>课程标题</label>
                  <input
                    className="form-input"
                    placeholder="请输入课程标题，例如：React 实战全流程 30 讲"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label className="form-label"><span className="required">*</span>所属分类</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-item">
                    <label className="form-label">标签</label>
                    <input
                      className="form-input"
                      placeholder="多个标签用逗号分隔"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-item">
                  <label className="form-label">课程简介</label>
                  <textarea
                    className="form-textarea"
                    placeholder="用一两句话介绍课程亮点、适合人群与学习收获"
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-item">
                <label className="form-label"><span className="required">*</span>课程封面</label>
                <ImageUpload value={cover} onChange={setCover} ratio="16:9" hint="上传封面图，建议 16:9" />
                <div className="form-hint">支持 JPG / PNG，大小不超过 10MB</div>
              </div>
            </div>
          </div>

          {/* 课时视频 */}
          <div className="card">
            <h3 className="card-title">课时视频</h3>
            <FileList
              items={lessons}
              onAdd={addFiles(setLessons)}
              onRemove={removeFile(setLessons)}
              accept="video/*"
              title="上传课时视频"
            />
            <div className="form-hint" style={{ marginTop: 10 }}>
              支持 MP4 / MOV / AVI 等格式，可按课时顺序依次上传；视频也可直接插入下方课程正文。
            </div>
          </div>

          {/* 课程正文（富文本） */}
          <div className="card">
            <h3 className="card-title">课程正文（图文视频混排）</h3>
            <RichEditor value={bodyHtml} onChange={setBodyHtml} height={460} />
          </div>

          {/* 附件资料 */}
          <div className="card">
            <h3 className="card-title">附件资料</h3>
            <FileList
              items={attachments}
              onAdd={addFiles(setAttachments)}
              onRemove={removeFile(setAttachments)}
              accept=".pdf,.doc,.docx,.zip,.rar,.ppt,.pptx"
              title="上传课件 / 资料附件"
            />
          </div>
        </div>

        {/* 右侧说明与实时统计 */}
        <div>
          <div className="card">
            <h3 className="card-title">发布须知</h3>
            <ul className="notice-list">
              <li>课程封面建议比例 16:9，画面清晰无水印。</li>
              <li>正文支持文字、图片、视频任意混排，图片建议先压缩后上传。</li>
              <li>课时视频与正文视频独立管理，附件仅对已购学员可见。</li>
              <li>发布前可点击「保存草稿」，随时继续编辑。</li>
            </ul>
          </div>

          <div className="card">
            <h3 className="card-title">内容统计</h3>
            <div className="summary-box">
              <div className="summary-row"><span className="k">正文字数</span><span className="v">{textLen} 字</span></div>
              <div className="summary-row"><span className="k">正文图片</span><span className="v">{imgCount} 张</span></div>
              <div className="summary-row"><span className="k">正文视频</span><span className="v">{videoCount} 段</span></div>
              <div className="summary-row"><span className="k">课时视频</span><span className="v">{lessons.length} 段</span></div>
              <div className="summary-row"><span className="k">附件资料</span><span className="v">{attachments.length} 个</span></div>
              <div className="summary-row">
                <span className="k">封面大小</span>
                <span className="v">{cover ? '已上传' : '未上传'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 发布成功弹窗 */}
      <Modal
        open={showSuccess}
        title="课程发布成功"
        width={520}
        onClose={() => setShowSuccess(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowSuccess(false)}>继续编辑</button>
            <button className="btn btn-primary" onClick={handleReset}>完成，再发一门</button>
          </>
        }
      >
        <div className="summary-box">
          <div className="summary-row"><span className="k">课程标题</span><span className="v">{title}</span></div>
          <div className="summary-row"><span className="k">所属分类</span><span className="v">{category}</span></div>
          <div className="summary-row"><span className="k">正文字数</span><span className="v">{textLen} 字</span></div>
          <div className="summary-row"><span className="k">正文图片</span><span className="v">{imgCount} 张</span></div>
          <div className="summary-row"><span className="k">正文视频</span><span className="v">{videoCount} 段</span></div>
          <div className="summary-row"><span className="k">课时视频</span><span className="v">{lessons.length} 段（{lessons.reduce((s, f) => s + f.size, 0).toFixed(0)} B）</span></div>
          <div className="summary-row"><span className="k">附件资料</span><span className="v">{attachments.length} 个</span></div>
        </div>
        <div className="form-hint" style={{ marginTop: 12 }}>
          Demo 环境下文件仅在本地预览，未上传至服务器；接入后端时请将图片、视频、附件分别提交至对应的上传接口。
        </div>
      </Modal>
    </div>
  )
}
