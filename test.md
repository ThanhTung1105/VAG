═══════════════════════════════════════════════════════ MODULE 7: POPOVER CHI TIẾT & DRAG REORDER ═══════════════════════════════════════════════════════ 

TC-7.1 Mở popover từ mỗi cấp Bước: Click lần lượt Program, Project, Phase, WP, Task, Subtask Kỳ vọng: Mỗi cấp mở popover đúng với các tab tương ứng [X] Pass / [ ] Fail 

TC-7.2 Tab Công việc — subtask card bo góc Bước: Mở popover Task → tab Đầu việc Kỳ vọng: - Mỗi subtask là 1 card bo góc (border + border-radius) - Có khoảng cách giữa các card - Hover card → highlight nhẹ [X ] Pass / [ ] Fail 

TC-7.3 Drag reorder task list Bước: Mở popover Phase → tab Gói công việc → kéo drag handle (⠿) Kỳ vọng: - Handle ⠿ hiện khi hover - Kéo → drop indicator (border xanh) - Thả → thứ tự đổi - Reload trang → thứ tự vẫn đúng (đã lưu DB) [x] Pass / [ ] Fail 

TC-7.4 Drag reorder subtask Bước: Mở popover Task → tab Đầu việc → kéo subtask Kỳ vọng: Tương tự TC-7.3, thứ tự lưu vào DB [x] Pass / [ ] Fail 

TC-7.5 Click task item KHÔNG navigate khi drag Bước: Kéo 1 task item rồi thả lại vị trí cũ Kỳ vọng: KHÔNG mở popover chi tiết (click bị skip khi drag) [ ] Pass / [x] Fail 

═══════════════════════════════════════════════════════ MODULE 8: RECALCULATION CASCADE ═══════════════════════════════════════════════════════ 

TC-8.1 Thêm subtask → recalc task Bước: Mở Task đang 100%/100% → thêm subtask mới Kỳ vọng: - Task: pctFinished < 100%, status ≠ completed - WP parent: pctFinished giảm tương ứng - Cascade lên Phase → Project → Program [x] Pass / [ ] Fail 

TC-8.2 Xóa subtask → recalc Bước: Xóa 1 subtask unfinished Kỳ vọng: Task pctFinished tăng (ít subtask hơn) [x] Pass / [ ] Fail 

TC-8.3 Toggle finish → recalc Bước: Toggle 1 subtask finished Kỳ vọng: Task pctFinished tăng, cascade lên trên [x] Pass / [ ] Fail 

TC-8.4 Approve → recalc Bước: Approve 1 subtask Kỳ vọng: Task pctApproved tăng [x] Pass / [ ] Fail 

TC-8.5 So sánh giữa các views Bước: Sau mỗi thay đổi subtask, kiểm tra cùng item ở cả 4 views Kỳ vọng: Tiến độ, trạng thái, health ĐỒNG NHẤT ở tất cả views [x] Pass / [ ] Fail 

═══════════════════════════════════════════════════════ MODULE 9: MEMBER CHIPS & INLINE DISPLAY ═══════════════════════════════════════════════════════ 

TC-9.1 PIC/Approver hiện inline chip Bước: Quan sát cột PIC và Approver ở view Thực thi Kỳ vọng: - Hiện dạng chip nhỏ: [🔵LN Long NNL] (border mỏng, avatar + tên) - KHÔNG phải avatar tròn + text rời [x] Pass / [ ] Fail 

TC-9.2 Người thực hiện hiện chip gọn Bước: Quan sát cột Người thực hiện Kỳ vọng: - Inline chips nhỏ gọn - Group chip cam nếu tất cả members của group được assign - 2 dòng tối đa, scroll ngang nếu quá dài [ ] Pass / [x] Fail 

═══════════════════════════════════════════════════════ MODULE 10: DATE & TIME ═══════════════════════════════════════════════════════ 

TC-10.1 Hiển thị ngày đúng format Bước: Kiểm tra cột Thời gian và Hoàn thành lúc Kỳ vọng: Format dd/mm/yyyy, center aligned [ ] Pass / [x] Fail 

TC-10.2 Hiển thị giờ khi có (showTime auto) Bước: Sửa 1 subtask có giờ cụ thể (14:30) → kiểm tra Kỳ vọng: Hiện "dd/mm/yyyy 14:30" (có giờ), không hiện "00:00" [x] Pass / [ ] Fail 

═══════════════════════════════════════════════════════ MODULE 11: PERFORMANCE & UX ═══════════════════════════════════════════════════════ 

TC-11.1 Không console error Bước: Mở F12 Console → thao tác tất cả chức năng Kỳ vọng: KHÔNG có lỗi đỏ (TypeError, 404, etc.) [x] Pass / [ ] Fail 

TC-11.2 Optimistic UI — checkbox không lag Bước: Click checkbox subtask Kỳ vọng: Checkbox đổi màu NGAY LẬP TỨC (< 100ms), không đợi network [x] Pass / [ ] Fail 

TC-11.3 Sync giữa các views Bước: Ở view Thực thi, tick checkbox → chuyển sang Điều hành Kỳ vọng: Dữ liệu đã cập nhật ở view Điều hành [x] Pass / [ ] Fail 

TC-11.4 Auto-refresh Bước: Mở 2 tab cùng trang → thay đổi ở tab 1 Kỳ vọng: Tab 2 tự cập nhật sau ~10s (polling sync) [x] Pass / [ ] Fail 