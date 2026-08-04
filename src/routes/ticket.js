const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase').service
const router = Router()
const { wantsJSON } = require('../lib/utils')

router.get('/', requireAuth, async (req, res) => {
    try {
        const { data: tickets } = await supabase.from('tickets')
            .select('*, last_message:ticket_messages(message, created_at, order(created_at.desc), limit(1))')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
        if (wantsJSON(req)) {
            res.json({ success: true, tickets })
        } else {
            res.render('tickets/index', { tickets })
        }
    } catch (err) {
        console.error('Ticket fetch error:', err)
        res.status(500).json({ error: 'Failed to fetch tickets' })
    }
})

router.post('/new', requireAuth, async (req, res) => {
    res.render('tickets/new')
})

router.post('/new', requireAuth, async (req, res) => {
    try {
        const subject = req.body.subject
        const section = req.body.section
        if (!subject) {
            if (wantsJSON(req)) return res.status(400).json({ success: false, error: { message: "Please provide a subject and a body for your ticket" } })
            return res.render('tickets/new', { user: req.user, error: 'Please provide a subject for your ticket' })
        }
        const ticket = { active: true, user_id: req.user.id, subject, section, created_at: new Date().toISOString() }
        const { data, error } = await supabase.from('tickets').insert(ticket).select().single()
        if (error) {
            if (wantsJSON(req)) return res.status(500).json({ success: false, error: error.message })
            return res.render('tickets/new', { user: req.user, error: error.message })
        }
        if (req.body.message) {
            await supabase.from('ticket_messages').insert({ ticket_id: data.id, user_id: req.user.id, message: req.body.message, created_at: new Date().toISOString() })
        }
        if (wantsJSON(req)) return res.json({ success: true, ticket: data })
        res.redirect('/tickets/' + data.id)
    } catch (err) {
        console.error('Ticket creation error:', err)
        if (wantsJSON(req)) return res.status(500).json({ success: false, error: 'Failed to create ticket' })
        res.render('tickets/new', { user: req.user, error: 'Failed to create ticket' })
    }
})

router.post('/:ticketId/close', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase.from('tickets').update({ active: false }).eq('id', req.params.ticketId).eq('user_id', req.user.id)
        if (error) {
            if (wantsJSON(req)) return res.status(500).json({ success: false, error: error.message })
            return res.redirect('/tickets/' + req.params.ticketId + '?error=' + encodeURIComponent(error.message))
        }
        if (wantsJSON(req)) return res.json({ success: true })
        res.redirect('/tickets/' + req.params.ticketId)
    } catch (err) {
        console.error('Ticket close error:', err)
        if (wantsJSON(req)) return res.status(500).json({ success: false, error: 'Failed to close ticket' })
        res.redirect('/tickets/' + req.params.ticketId)
    }
})

router.post('/:ticketId/reopen', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase
            .from('tickets').update({ active: true })
            .eq('id', req.params.ticketId).eq('user_id', req.user.id)
        if (error) {
            if (wantsJSON(req)) return res.status(500).json({ success: false, error: error.message })
            return res.redirect('/tickets/' + req.params.ticketId + '?error=' + encodeURIComponent(error.message))
        }
        if (wantsJSON(req)) return res.json({ success: true })
        res.redirect('/tickets/' + req.params.ticketId)
    } catch (err) {
        console.error('Ticket reopen error:', err)
        if (wantsJSON(req)) return res.status(500).json({ success: false, error: 'Failed to reopen ticket' })
        res.redirect('/tickets/' + req.params.ticketId)
    }
})

router.post('/:ticketId/comment', requireAuth, async (req, res) => {
    try {
        const message = (req.body.content?.message || req.body.message || '').trim()
        if (!message) {
            if (wantsJSON(req)) return res.status(400).json({ success: false, error: 'Comment content required' })
            return res.redirect('/tickets/' + req.params.ticketId + '?error=' + encodeURIComponent('Comment content required'))
        }
        const { error } = await supabase.from('ticket_messages').insert({ ticket_id: req.params.ticketId, user_id: req.user.id, message, created_at: new Date().toISOString() })
        if (error) {
            if (wantsJSON(req)) return res.status(500).json({ success: false, error: error.message })
            return res.redirect('/tickets/' + req.params.ticketId + '?error=' + encodeURIComponent(error.message))
        }
        if (wantsJSON(req)) return res.json({ success: true })
        res.redirect('/tickets/' + req.params.ticketId)
    } catch (err) {
        console.error('Ticket comment error:', err)
        if (wantsJSON(req)) return res.status(500).json({ success: false, error: 'Failed to add comment' })
        res.redirect('/tickets/' + req.params.ticketId)
    }
})

router.get('/:ticketId', requireAuth, async (req, res) => {
    try {
        const { data: ticket, error } = await supabase.from('tickets').select('*').eq('id', req.params.ticketId).eq('user_id', req.user.id).single()
        if (error || !ticket) {
            if (wantsJSON(req)) return res.status(404).json({ error: 'Ticket not found' })
            return res.status(404).render('tickets/show', { user: req.user, ticket: null, comments: [], error: 'Ticket not found' })
        }
        const { data: comments } = await supabase.from('ticket_messages').select('*').eq('ticket_id', req.params.ticketId).order('created_at', { ascending: true })
        if (wantsJSON(req)) return res.json({ ticket, comments: comments || [] })
        res.render('tickets/show', { user: req.user, ticket, comments: comments || [], error: req.query.error || null })
    } catch (err) {
        console.error('Ticket fetch error:', err)
        if (wantsJSON(req)) return res.status(500).json({ error: 'Failed to fetch ticket' })
        res.status(500).render('tickets/show', { user: req.user, ticket: null, comments: [], error: 'Failed to fetch ticket' })
    }
})

module.exports = router