# VietAnh PMO — Hệ thống Quản lý Dự án

## Tổng quan

VietAnh PMO là ứng dụng quản lý dự án (Project Management Office) cho Việt Anh Group, xây dựng trên nền tảng Flask + vanilla JS. Hệ thống theo dõi toàn bộ danh mục đầu tư (portfolio) từ cấp chương trình (program) xuống đến từng đầu việc nhỏ nhất (subtask) theo cấu trúc phân cấp 6 tầng.

## Cấu trúc phân cấp

```
Portfolio
└── Program (Chương trình)
    └── Project (Dự án)
        └── Phase (Giai đoạn)
            └── Work Package (Gói công việc)
                └── Task (Công việc)
                    └── Subtask (Đầu việc)
```

Mỗi cấp đều có: tên, mô tả, PIC (người phụ trách), Approver (người phê duyệt), ngày kế hoạch, trạng thái, sức khỏe (health), tiến độ (% hoàn thành, % phê duyệt).

## Công nghệ

| Layer | Stack |
|-------|-------|
| Backend | Python 3.11+, Flask, SQLAlchemy, SQLite (dev) / MySQL (prod) |
| Frontend | Vanilla JS (ES5), CSS3 thuần, không framework |
| Auth | Session-based (Flask session) |
| Deploy | PythonAnywhere (WSGI) |

## Cài đặt & Chạy

```bash
# Clone và cài dependencies
cd vietanh-pmo
pip install flask flask-sqlalchemy --break-system-packages

# Khởi tạo database + seed data
python seed.py --reset

# Chạy development server
python wsgi.py
# → http://localhost:5000
```

**Tài khoản mặc định:** `long.nnl@vietanh-group.com` / `admin`

## Chức năng chính

### 1. Gantt Chart — 4 View

Truy cập qua `/gantt` hoặc các URL riêng:

| View | URL | Nội dung |
|------|-----|----------|
| Chiến lược | `/gantt/chien_luoc` | Program → Project, mũi tên phase |
| Kế hoạch | `/gantt/ke_hoach` | Project → Phase → WP timeline |
| Điều hành | `/gantt/dieu_hanh` | Phase → WP → Task gantt bars |
| Thực thi | `/gantt/thuc_thi` | Bảng full-width, tất cả cấp expand |

Chuyển view bằng các nút trên toolbar. URL tự động cập nhật (history.replaceState), có thể bookmark/chia sẻ link trực tiếp.

### 2. View Thực thi (Execution View)

Bảng dạng Excel với 14 cột, hiển thị toàn bộ hierarchy expand sẵn:

**Các cột:** Tên, PIC, Approver, Người thực hiện, Thời gian, Tiến độ, Hình thức, Cách làm, Trạng thái, Sức khỏe, Hoàn thành lúc, KQ chính, Link, Ghi chú

**Tính năng:**
- Expand/collapse từng cấp (click mũi tên)
- Resize cột ngang (drag handle ở mép phải header)
- Resize chiều cao dòng (drag handle ở dưới mỗi dòng)
- Phân cấp màu sắc (6 mức từ xanh đậm → trắng → xám)
- Gradient indent: phần lề trái trắng, nội dung bắt đầu từ màu cấp
- Click dòng → mở popover chi tiết

**Checkbox subtask:**
- ☐ (trống) = chưa hoàn thành
- ☑ tím = đã hoàn thành (chờ duyệt)
- ☑ xanh lá = đã phê duyệt
- Click checkbox → toggle ngay (optimistic UI), backend cập nhật sau

**Duyệt:**
- Click chip "Chờ duyệt" trên subtask → popover "Duyệt" / "Từ chối"
- Click chip trạng thái trên task (có subtask chờ duyệt) → "Duyệt tất cả" / "Từ chối tất cả"

### 3. Column Filters (View Thực thi)

| Cột | Loại filter |
|-----|-------------|
| Tên | Text search (debounce 300ms) |
| PIC, Approver, Người thực hiện | Toggle "Có tôi" |
| Thời gian, Hoàn thành lúc | Toggle "Tuần này" / "Hôm nay" |
| Trạng thái, Sức khỏe, Hình thức | Multi-select dropdown (icon filter ở header) |

Filter hierarchy-aware: nếu child match → parent vẫn hiện.

### 4. Member Groups

**Backend:** Model `MemberGroup` với M2M relationship đến `Member`.

**4 nhóm mặc định:**
- Ban Chiến Lược (cam): Long NNL, Anh LTD
- Team IT (xanh dương): Long NNL, Hà NTT, Minh PT
- Citek SAP (tím): Citek Team
- Team M365 (xanh lá): Long NNL, Tùng NV

**Picker popover:** Khi assign thành viên, popover hiện section "Nhóm" phía trên section "Thành viên". Chọn nhóm = chọn tất cả thành viên trong nhóm.

**Logic Phương án 3 (uncheck group):**
- Bỏ tick nhóm A → chỉ bỏ thành viên **chỉ thuộc nhóm A**
- Thành viên thuộc nhóm B đang chọn → được giữ lại (protected)
- Bỏ tick 1 thành viên riêng lẻ → nhóm chứa thành viên đó tự uncheck

**Chip hiển thị:**
- Member chip: `[🔵LN Long NNL]` (border mỏng xanh)
- Group chip: `[🟠BC Ban Chiến Lược]` (border cam)
- Hover group chip → tooltip danh sách thành viên (fixed position, không bị clip)

### 5. Popover Chi tiết

Click vào bất kỳ item nào → mở popover với các tab:

| Tab | Nội dung |
|-----|---------|
| Tổng quan | Tên, mô tả, PIC, Approver, Assignees, ngày, trạng thái, health, tiến độ, hình thức, cách làm |
| Đầu việc/Công việc | Danh sách con (subtasks/tasks/phases...) dạng card bo góc |
| Phê duyệt | Danh sách subtask chờ duyệt (chỉ task level) |
| Ghi chú | Notes |
| Lịch sử | Audit trail |

**Drag reorder:** Kéo thả các item con trong mọi tab (drag handle `⠿`). Thứ tự lưu vào DB (`sort_order`), áp dụng cho tất cả user.

### 6. RAIQD Module

5 loại: Risk, Issue, Action, Question, Decision. Mỗi loại có severity, status, PIC (M2M), mô tả, giải pháp. Link được giữa RAIQD items và work items.

### 7. Recalculation Engine

Khi thay đổi subtask → cascade tính lại tự động lên TẤT CẢ cấp trên:

```
Subtask change → Task → Work Package → Phase → Project → Program
```

**Tính toán:**
- `pctFinished` = % subtask finished hoặc approved / tổng subtasks
- `pctApproved` = % subtask approved / tổng subtasks
- `status`: not_started → in_progress → in_review → completed
- `health`: on_track / at_risk (≥90% thời gian) / behind_schedule (quá hạn)
- `actual_finish`: tự set khi task completed, tự clear khi mất completed

### 8. Hệ thống khác

- **Auth:** Login session-based, 3 system roles (admin/member/viewer)
- **Permissions:** system_role + project_access + item ownership
- **Audit Trail:** Tự động ghi log mọi thay đổi (before_flush/after_flush)
- **Sync:** Polling `/api/portfolio/version` mỗi 10s, auto-refresh khi có thay đổi
- **Admin:** CRUD members, roles qua `/admin`

## Cấu trúc thư mục

```
vietanh-pmo/
├── app.py              # Flask app factory + routes
├── wsgi.py             # WSGI entry point
├── config.py           # Config (SQLite dev / MySQL prod)
├── extensions.py       # db = SQLAlchemy()
├── seed.py             # Seed data từ demo_gantt_seed.html
├── models/             # SQLAlchemy models (21 files)
├── routes/             # API routes (14 files)
├── services/           # Business logic
│   ├── recalc.py       # Cascade recalculation engine
│   ├── tree.py         # Build portfolio tree for API
│   ├── audit.py        # Auto-audit via SQLAlchemy events
│   ├── permissions.py  # 3-layer permission system
│   └── ...
└── static/
    ├── gantt.html       # Main SPA page
    ├── tokens.css       # Design tokens (colors, fonts)
    └── components/
        ├── api_client.js    # PMO.API — fetch wrapper
        ├── api_hooks.js     # GanttChart overrides (1158 lines)
        ├── sidebar.js       # Navigation sidebar
        ├── common/          # Shared UI components
        │   ├── chip_member.js   # Member + Group chips
        │   ├── avatar.js        # Avatar circles
        │   ├── status_chip.js   # Status badges
        │   ├── health_chip.js   # Health indicators
        │   ├── misc.js          # Date, Textbox, SubtaskStatus
        │   └── ...
        ├── gantt/           # Gantt-specific
        │   ├── gantt.js         # Core GanttChart (read-only)
        │   ├── gantt_utils.js   # Calc utilities
        │   ├── exec_view.js     # Execution view (725 lines)
        │   └── exec_filter.js   # Column filters (265 lines)
        └── popover_detail/  # Detail popover
            ├── fields.js        # MemberField, ExecMode, ProgressInline
            ├── popover_shell.js # Popover container
            ├── subtask.js       # Subtask list + drag
            ├── task_list.js     # Task/WP/Phase list + drag
            └── ...
```

## API Endpoints chính

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Thông tin user hiện tại |
| GET | `/api/portfolio` | Tree data toàn bộ portfolio |
| GET | `/api/portfolio/version` | Version number cho sync |
| PUT | `/api/reorder` | Bulk reorder children |
| GET | `/api/members-and-groups` | Members + Groups cho picker |
| CRUD | `/api/member-groups` | CRUD nhóm thành viên |
| POST | `/api/tasks/:id/subtasks` | Tạo subtask |
| PATCH | `/api/subtasks/:id/finish` | Toggle finish status |
| PATCH | `/api/subtasks/:id/approve` | Approve/Reject subtask |
| GET | `/api/subtask-sort/:task_id` | Personal subtask sort order |
| PUT | `/api/subtask-sort/:task_id` | Save personal sort order |