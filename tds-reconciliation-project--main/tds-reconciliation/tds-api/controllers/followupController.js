import db from '../config/db.js';

/**
 * Get Follow-up Summary Counts
 */
export const getFollowupSummary = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [rows] = await db.execute(`
      SELECT 
        COUNT(*) as totalFollowedUp,
        SUM(CASE WHEN status IN ('Call Tomorrow', 'Check & Revert', 'Mailed', 'Pending') THEN 1 ELSE 0 END) as pendingResponse,
        SUM(CASE WHEN status = 'Call Not Picked Up' THEN 1 ELSE 0 END) as callNotPickedUp,
        SUM(CASE WHEN status = 'Check & Revert' THEN 1 ELSE 0 END) as checkAndRevert,
        SUM(CASE WHEN status = 'TDS Paid' THEN 1 ELSE 0 END) as tdsPaid,
        SUM(CASE WHEN status = 'Form Received' THEN 1 ELSE 0 END) as formReceived,
        SUM(CASE WHEN next_followup_date IS NOT NULL AND next_followup_date <= ? AND status NOT IN ('TDS Paid', 'Form Received') THEN 1 ELSE 0 END) as dueForFollowup
      FROM tds_followups
    `, [todayStr]);

    const summary = rows[0] || {
      totalFollowedUp: 0,
      pendingResponse: 0,
      callNotPickedUp: 0,
      checkAndRevert: 0,
      tdsPaid: 0,
      formReceived: 0,
      dueForFollowup: 0
    };

    res.json({
      success: true,
      data: {
        totalFollowedUp: Number(summary.totalFollowedUp || 0),
        pendingResponse: Number(summary.pendingResponse || 0),
        callNotPickedUp: Number(summary.callNotPickedUp || 0),
        checkAndRevert: Number(summary.checkAndRevert || 0),
        tdsPaid: Number(summary.tdsPaid || 0),
        formReceived: Number(summary.formReceived || 0),
        dueForFollowup: Number(summary.dueForFollowup || 0)
      }
    });

  } catch (error) {
    console.error('💥 Error in getFollowupSummary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch follow-up summary', details: error.message });
  }
};

/**
 * Get Filtered Follow-up Entries List
 */
export const getFollowups = async (req, res) => {
  try {
    const {
      status,
      dateRange = 'year',
      startDate,
      endDate,
      search = '',
      dueOnly = 'false',
      responseFilter = ''
    } = req.query;

    let whereClauses = [];
    const params = [];

    if (search && search.trim()) {
      const wild = `%${search.trim()}%`;
      whereClauses.push('(company_name LIKE ? OR tan_no LIKE ? OR contact_person LIKE ? OR department LIKE ? OR notes LIKE ?)');
      params.push(wild, wild, wild, wild, wild);
    }

    if (status && status !== 'All') {
      const statuses = Array.isArray(status) ? status : String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        const placeholders = statuses.map(() => '?').join(',');
        whereClauses.push(`status IN (${placeholders})`);
        params.push(...statuses);
      }
    }

    const now = new Date();
    if (dateRange === 'year') {
      const yearStart = `${now.getFullYear()}-01-01`;
      whereClauses.push('followup_date >= ?');
      params.push(yearStart);
    } else if (dateRange === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const qStart = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
      whereClauses.push('followup_date >= ?');
      params.push(qStart);
    } else if (dateRange === 'month') {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      whereClauses.push('followup_date >= ?');
      params.push(mStart);
    } else if (dateRange === 'custom') {
      if (startDate) {
        whereClauses.push('followup_date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereClauses.push('followup_date <= ?');
        params.push(endDate);
      }
    }
    // Note: dateRange === 'all' will add no date constraint

    if (dueOnly === 'true' || dueOnly === true) {
      const todayStr = now.toISOString().split('T')[0];
      whereClauses.push("next_followup_date IS NOT NULL AND next_followup_date <= ? AND status NOT IN ('TDS Paid', 'Form Received')");
      params.push(todayStr);
    }

    if (responseFilter === 'responded') {
      whereClauses.push("status IN ('TDS Paid', 'Form Received', 'Check & Revert', 'Mail Reply')");
    } else if (responseFilter === 'no_response') {
      whereClauses.push("status IN ('Call Not Picked Up', 'Call Tomorrow', 'HR Left', 'Mailed')");
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';


    const query = `
      SELECT 
        id,
        tan_no as tanNo,
        company_name as companyName,
        contact_person as contactPerson,
        department,
        contact_number as contactNumber,
        method,
        status,
        notes,
        followup_date as followupDate,
        next_followup_date as nextFollowupDate,
        created_by as createdBy,
        created_at as createdAt,
        updated_at as updatedAt
      FROM tds_followups
      ${whereSQL}
      ORDER BY followup_date DESC, id DESC
    `;

    const [rows] = await db.execute(query, params);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('💥 Error in getFollowups:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch follow-ups list', details: error.message });
  }
};

/**
 * Create New Follow-up Entry
 */
export const createFollowup = async (req, res) => {
  try {
    const {
      tanNo,
      companyName,
      contactPerson,
      department,
      contactNumber,
      method = 'Call',
      status = 'Call Tomorrow',
      notes,
      followupDate = new Date().toISOString().split('T')[0],
      nextFollowupDate,
      createdBy = 'Accounts Manager'
    } = req.body;

    if (!tanNo || !companyName || !status) {
      return res.status(400).json({ success: false, error: 'Required fields missing: tanNo, companyName, status' });
    }

    const insertQuery = `
      INSERT INTO tds_followups 
      (tan_no, company_name, contact_person, department, contact_number, method, status, notes, followup_date, next_followup_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      String(tanNo).toUpperCase().trim(),
      companyName.trim(),
      contactPerson ? contactPerson.trim() : null,
      department ? department.trim() : null,
      contactNumber ? contactNumber.trim() : null,
      method,
      status,
      notes ? notes.trim() : null,
      followupDate,
      nextFollowupDate || null,
      createdBy
    ]);

    res.json({
      success: true,
      message: 'Follow-up logged successfully',
      id: result.insertId
    });

  } catch (error) {
    console.error('💥 Error in createFollowup:', error);
    res.status(500).json({ success: false, error: 'Failed to create follow-up', details: error.message });
  }
};

/**
 * Update Existing Follow-up Entry
 */
export const updateFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tanNo,
      companyName,
      contactPerson,
      department,
      contactNumber,
      method,
      status,
      notes,
      followupDate,
      nextFollowupDate,
      createdBy = 'Accounts Manager'
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Follow-up ID required' });
    }

    const targetId = isNaN(parseInt(id)) ? id : parseInt(id);
    const updates = [];
    const params = [];

    if (contactPerson !== undefined) { updates.push('contact_person = ?'); params.push(contactPerson); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (contactNumber !== undefined) { updates.push('contact_number = ?'); params.push(contactNumber); }
    if (method !== undefined) { updates.push('method = ?'); params.push(method); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (followupDate !== undefined) { updates.push('followup_date = ?'); params.push(followupDate); }
    if (nextFollowupDate !== undefined) { updates.push('next_followup_date = ?'); params.push(nextFollowupDate); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    params.push(targetId);

    const updateQuery = `
      UPDATE tds_followups 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    const [result] = await db.execute(updateQuery, params);

    if (!result || result.affectedRows === 0) {
      // Auto-insert fallback if editing an unpersisted or sample record
      const insertQuery = `
        INSERT INTO tds_followups 
        (tan_no, company_name, contact_person, department, contact_number, method, status, notes, followup_date, next_followup_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [insertRes] = await db.execute(insertQuery, [
        String(tanNo || 'N/A').toUpperCase().trim(),
        companyName ? companyName.trim() : 'Company Name',
        contactPerson ? contactPerson.trim() : null,
        department ? department.trim() : null,
        contactNumber ? contactNumber.trim() : null,
        method || 'Call',
        status || 'Call Tomorrow',
        notes ? notes.trim() : null,
        followupDate || new Date().toISOString().split('T')[0],
        nextFollowupDate || null,
        createdBy
      ]);

      return res.json({
        success: true,
        message: 'Follow-up created successfully',
        id: insertRes.insertId
      });
    }

    res.json({
      success: true,
      message: 'Follow-up updated successfully'
    });

  } catch (error) {
    console.error('💥 Error in updateFollowup:', error);
    res.status(500).json({ success: false, error: 'Failed to update follow-up', details: error.message });
  }
};
