from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from bson.objectid import ObjectId
import os
import time
import base64


def serialize_doc(doc: dict):
    """Recursively convert ObjectId values in a dict to strings so jsonify works."""
    if not isinstance(doc, dict):
        return doc
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, list):
            new_list = []
            for item in v:
                if isinstance(item, ObjectId):
                    new_list.append(str(item))
                elif isinstance(item, dict):
                    new_list.append(serialize_doc(item))
                else:
                    new_list.append(item)
            doc[k] = new_list
        elif isinstance(v, dict):
            doc[k] = serialize_doc(v)
    return doc

app = Flask(__name__)
# Explicitly allow common methods (including DELETE and OPTIONS) for API routes to avoid browser preflight 405 errors
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client["internlink"]

# Ensure unique email indexes
try:
    db.users.create_index("email", unique=True)
    db.companies.create_index("email", unique=True)
except Exception:
    pass

# Seed a default admin user (if not present) so an admin can log in during development.
def seed_admin_user():
    admin_email = os.getenv("ADMIN_EMAIL", "admin@internlink.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "adminpass")
    try:
        existing = db.users.find_one({"email": admin_email})
        if not existing:
            hashed = generate_password_hash(admin_password)
            admin_doc = {
                "fullName": "Platform Admin",
                "email": admin_email,
                "password": hashed,
                "userType": "admin",
                "isAdmin": True
            }
            db.users.insert_one(admin_doc)
            print(f"Seeded admin user: {admin_email}")
    except Exception as e:
        print("Failed to seed admin user:", e)

# run seeding at startup
seed_admin_user()

@app.route("/api/users", methods=["POST"])
def add_user():
    data = request.json
    role = data.get("userType")
    if not data.get("email") or not data.get("password"):
        return jsonify({"msg": "Missing email or password"}), 400

    # Hash password before storing
    data_to_store = data.copy()
    data_to_store["password"] = generate_password_hash(data["password"])

    try:
        if role == "company":
            # Insert into companies collection
            result = db.companies.insert_one(data_to_store)
        else:
            result = db.users.ins
            ert_one(data_to_store)
    except Exception as e:
        # Handle duplicate key error
        if 'duplicate key' in str(e).lower():
            return jsonify({"msg": "Email already registered"}), 409
        return jsonify({"msg": "Server error", "error": str(e)}), 500

    # Return created user summary (do not include password)
    created = {
        "id": str(result.inserted_id),
        "email": data.get("email"),
        "userType": role
    }
    return jsonify({"msg": "User created", "user": created}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    role = data.get("userType")
    collection = db.users if role != "company" else db.companies

    user = collection.find_one({"email": email})
    if user and check_password_hash(user["password"], password):
        # Return safe user fields
        safe_user = {k: v for k, v in user.items() if k not in ("password",)}
        if safe_user.get("_id"):
            safe_user["id"] = str(safe_user.pop("_id"))
        return jsonify({"msg": "Login successful", "user": safe_user}), 200
    else:
        return jsonify({"msg": "Invalid credentials"}), 401

# Internships endpoints
@app.route('/api/internships', methods=['POST'])
def create_internship():
    data = request.json
    required = ['title', 'company', 'companyEmail']
    if not all(k in data and data[k] for k in required):
        return jsonify({'msg': 'Missing required fields'}), 400
    data_to_store = data.copy()
    data_to_store['posted'] = data_to_store.get('posted') or ''
    try:
        res = db.internships.insert_one(data_to_store)
        created = { 'id': str(res.inserted_id), **{k: data_to_store[k] for k in data_to_store if k != 'description' } }
        # serialize to ensure no ObjectId remains
        created = serialize_doc(created)
        # notify: nothing here, frontend will fetch
        return jsonify({'msg': 'Internship created', 'internship': created}), 201
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/internships', methods=['GET'])
def list_internships():
    company = request.args.get('company') or request.args.get('companyEmail')
    q = request.args.get('q', '').strip()
    query = {}
    if company:
        query = {'$or': [{'company': company}, {'companyEmail': company}]}
    if q:
        qfilter = {'$or': [{'title': {'$regex': q, '$options': 'i'}}, {'position': {'$regex': q, '$options': 'i'}}, {'company': {'$regex': q, '$options': 'i'}}, {'tags': {'$regex': q, '$options': 'i'}}]}
        if query:
            query = {'$and': [query, qfilter]}
        else:
            query = qfilter
    docs = list(db.internships.find(query))
    for d in docs:
        d['id'] = str(d.pop('_id'))
        serialize_doc(d)
    return jsonify({'internships': docs}), 200

@app.route('/api/internships/<internship_id>', methods=['PUT'])
def update_internship(internship_id):
    data = request.json or {}
    # only allow these fields to be updated
    allowed = ['title', 'duration', 'location', 'stipend', 'tags', 'description', 'deadline', 'company', 'companyEmail', 'posted', 'status']
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        return jsonify({'msg': 'Nothing to update'}), 400
    try:
        # try to treat id as ObjectId
        try:
            oid = ObjectId(internship_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': internship_id}
        res = db.internships.update_one(query, {'$set': update})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        doc = db.internships.find_one(query)
        if not doc:
            return jsonify({'msg': 'Not found after update'}), 404
        # serialize and return
        doc['id'] = str(doc.pop('_id'))
        serialize_doc(doc)
        return jsonify({'msg': 'Updated', 'internship': doc}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/internships/<internship_id>/approve', methods=['POST'])
def approve_internship(internship_id):
    try:
        try:
            oid = ObjectId(internship_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': internship_id}
        res = db.internships.update_one(query, {'$set': {'status': 'Active'}})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Approved'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/internships/<internship_id>/reject', methods=['POST'])
def reject_internship(internship_id):
    try:
        try:
            oid = ObjectId(internship_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': internship_id}
        res = db.internships.update_one(query, {'$set': {'status': 'Rejected'}})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Rejected'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

# Applications endpoints
@app.route('/api/applications', methods=['POST'])
def create_application():
    data = request.json
    required = ['internshipId', 'studentEmail', 'studentName', 'company']
    if not all(k in data and data[k] for k in required):
        return jsonify({'msg': 'Missing required fields'}), 400
    data_to_store = data.copy()
    # ensure we have an applied date so frontend can show "Applied On"
    if not data_to_store.get('appliedDate') and not data_to_store.get('applied'):
        data_to_store['appliedDate'] = __import__('datetime').datetime.utcnow().isoformat()
    data_to_store['status'] = data_to_store.get('status') or 'In Review'
    # If an internshipId is provided, try to embed a snapshot of that internship
    try:
        iid = data_to_store.get('internshipId')
        if iid:
            internship_doc = None
            try:
                internship_doc = db.internships.find_one({'_id': ObjectId(iid)})
            except Exception:
                internship_doc = db.internships.find_one({'_id': iid}) or db.internships.find_one({'id': str(iid)})
            if internship_doc:
                # build a small snapshot that's safe to store in application
                snap = {
                    'id': str(internship_doc.get('_id') or internship_doc.get('id') or ''),
                    'position': internship_doc.get('position') or internship_doc.get('title') or '',
                    'title': internship_doc.get('title') or '',
                    'company': internship_doc.get('company') or internship_doc.get('companyName') or '',
                    'stipend': internship_doc.get('stipend') or internship_doc.get('salary') or internship_doc.get('remuneration') or '',
                    'location': internship_doc.get('location') or internship_doc.get('city') or '',
                    'duration': internship_doc.get('duration') or internship_doc.get('period') or '',
                    'deadline': internship_doc.get('deadline') or '',
                    'tags': internship_doc.get('tags') or internship_doc.get('skills') or []
                }
                data_to_store['internship'] = snap
                # prefer using snapshot values to fill top-level fields for backwards compatibility
                data_to_store['internshipTitle'] = data_to_store.get('internshipTitle') or snap['position'] or snap['title']
                data_to_store['company'] = data_to_store.get('company') or snap['company']
                data_to_store['stipend'] = data_to_store.get('stipend') or snap['stipend']
    except Exception:
        pass
    try:
        res = db.applications.insert_one(data_to_store)
        created = { 'id': str(res.inserted_id), **data_to_store }
        created = serialize_doc(created)
        return jsonify({'msg': 'Application created', 'application': created}), 201
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/applications', methods=['GET'])
def list_applications():
    company = request.args.get('company') or request.args.get('companyEmail')
    student = request.args.get('studentEmail')
    internshipId = request.args.get('internshipId')
    query = {}
    if company:
        query['company'] = company
    if student:
        query['studentEmail'] = student
    if internshipId:
        try:
            query['internshipId'] = int(internshipId)
        except Exception:
            query['internshipId'] = internshipId
    docs = list(db.applications.find(query))
    out = []
    for d in docs:
        d['id'] = str(d.pop('_id'))
        # try to enrich missing student fields from users collection
        enrich_application_with_user(d)
        # If application has an internshipId but no embedded snapshot, try to fetch and attach snapshot
        try:
            if not d.get('internship'):
                iid = d.get('internshipId')
                if iid:
                    internship_doc = None
                    try:
                        internship_doc = db.internships.find_one({'_id': ObjectId(iid)})
                    except Exception:
                        internship_doc = db.internships.find_one({'_id': iid}) or db.internships.find_one({'id': str(iid)})
                    if internship_doc:
                        snap = {
                            'id': str(internship_doc.get('_id') or internship_doc.get('id') or ''),
                            'position': internship_doc.get('position') or internship_doc.get('title') or '',
                            'title': internship_doc.get('title') or '',
                            'company': internship_doc.get('company') or internship_doc.get('companyName') or '',
                            'stipend': internship_doc.get('stipend') or internship_doc.get('salary') or internship_doc.get('remuneration') or '',
                            'location': internship_doc.get('location') or internship_doc.get('city') or '',
                            'duration': internship_doc.get('duration') or internship_doc.get('period') or '',
                            'deadline': internship_doc.get('deadline') or '',
                            'tags': internship_doc.get('tags') or internship_doc.get('skills') or []
                        }
                        d['internship'] = snap
                        d['stipend'] = d.get('stipend') or snap['stipend']
        except Exception:
            pass
        serialize_doc(d)
        out.append(d)
    return jsonify({'applications': out}), 200

@app.route('/api/applications/<app_id>', methods=['PUT'])
def update_application(app_id):
    data = request.json
    update = {}
    if 'status' in data:
        update['status'] = data['status']
    if not update:
        return jsonify({'msg': 'Nothing to update'}), 400
    try:
        res = db.applications.update_one({'_id': ObjectId(app_id)}, {'$set': update})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Updated'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/applications/<app_id>', methods=['GET'])
def get_application(app_id):
    try:
        try:
            oid = ObjectId(app_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': app_id}
        doc = db.applications.find_one(query)
        if not doc:
            return jsonify({'msg': 'Not found'}), 404
        doc['id'] = str(doc.pop('_id'))
        # enrich with user profile if missing
        enrich_application_with_user(doc)
        # If no embedded internship snapshot, attach one and set stipend
        try:
            if not doc.get('internship'):
                iid = doc.get('internshipId')
                if iid:
                    internship_doc = None
                    try:
                        internship_doc = db.internships.find_one({'_id': ObjectId(iid)})
                    except Exception:
                        internship_doc = db.internships.find_one({'_id': iid}) or db.internships.find_one({'id': str(iid)})
                    if internship_doc:
                        snap = {
                            'id': str(internship_doc.get('_id') or internship_doc.get('id') or ''),
                            'position': internship_doc.get('position') or internship_doc.get('title') or '',
                            'title': internship_doc.get('title') or '',
                            'company': internship_doc.get('company') or internship_doc.get('companyName') or '',
                            'stipend': internship_doc.get('stipend') or internship_doc.get('salary') or internship_doc.get('remuneration') or '',
                            'location': internship_doc.get('location') or internship_doc.get('city') or '',
                            'duration': internship_doc.get('duration') or internship_doc.get('period') or '',
                            'deadline': internship_doc.get('deadline') or '',
                            'tags': internship_doc.get('tags') or internship_doc.get('skills') or []
                        }
                        doc['internship'] = snap
                        doc['stipend'] = doc.get('stipend') or snap['stipend']
        except Exception:
            pass
        serialize_doc(doc)
        return jsonify({'application': doc}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
def list_users():
    q = request.args.get('q', '').strip()
    query = {}
    if q:
        # search in name or email
        query = {'$or': [{'fullName': {'$regex': q, '$options': 'i'}}, {'email': {'$regex': q, '$options': 'i'}}]}
    docs = list(db.users.find(query))
    users = []
    for u in docs:
        safe = {k: v for k, v in u.items() if k != 'password'}
        if safe.get('_id'):
            safe['id'] = str(safe.pop('_id'))
        users.append(serialize_doc(safe))
    return jsonify({'users': users}), 200

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        try:
            oid = ObjectId(user_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': user_id}
        res = db.users.delete_one(query)
        if res.deleted_count == 0:
            # try companies collection
            res2 = db.companies.delete_one(query)
            if res2.deleted_count == 0:
                return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/users/<user_id>/suspend', methods=['POST'])
def suspend_user(user_id):
    try:
        try:
            oid = ObjectId(user_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': user_id}
        res = db.users.update_one(query, {'$set': {'status': 'Suspended'}})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Suspended'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/users/<user_id>/activate', methods=['POST'])
def activate_user(user_id):
    try:
        try:
            oid = ObjectId(user_id)
            query = {'_id': oid}
        except Exception:
            query = {'_id': user_id}
        res = db.users.update_one(query, {'$set': {'status': 'Active'}})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Activated'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/admin/analytics', methods=['GET'])
def admin_analytics():
    try:
        total_users = db.users.count_documents({})
        total_companies = db.companies.count_documents({})
        total_internships = db.internships.count_documents({})
        pending_approvals = db.internships.count_documents({'status': 'Pending Approval'})
        total_applications = db.applications.count_documents({})
        active_students = db.users.count_documents({'userType': {'$in': [None, 'student', '']}})

        # application status breakdown
        selected_count = db.applications.count_documents({'status': 'Selected'})
        in_review_count = db.applications.count_documents({'status': {'$in': ['In Review', 'Pending', None]}})
        rejected_count = db.applications.count_documents({'status': 'Rejected'})

        # top universities (from student profiles)
        try:
            pipeline = [
                {'$match': {'university': {'$exists': True, '$ne': ''}}},
                {'$group': {'_id': '$university', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 6}
            ]
            uni_aggr = list(db.users.aggregate(pipeline))
            top_universities = [{'university': u['_id'], 'count': u['count']} for u in uni_aggr]
        except Exception:
            top_universities = []

        # top companies by internships posted
        try:
            pipeline = [
                {'$match': {'company': {'$exists': True, '$ne': ''}}},
                {'$group': {'_id': '$company', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 6}
            ]
            comp_aggr = list(db.internships.aggregate(pipeline))
            top_companies = [{'company': c['_id'], 'count': c['count']} for c in comp_aggr]
        except Exception:
            top_companies = []

        res = {
            'totalUsers': total_users + total_companies,
            'activeStudents': active_students,
            'activeCompanies': total_companies,
            'totalInternships': total_internships,
            'pendingApprovals': pending_approvals,
            'thisMonthApplications': total_applications,
            'applicationStatusCounts': {
                'selected': selected_count,
                'inReview': in_review_count,
                'rejected': rejected_count,
                'total': total_applications
            },
            'topUniversities': top_universities,
            'topCompanies': top_companies
        }
        return jsonify(res), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500
    

@app.route('/api/company/overview', methods=['GET'])
def company_overview():
    """Return aggregated overview stats for a company (pass company name or email as query param `company`)."""
    company = request.args.get('company') or request.args.get('companyEmail')
    if not company:
        return jsonify({'msg': 'Missing company parameter'}), 400
    try:
        # internships for this company
        query = {'$or': [{'company': company}, {'companyEmail': company}]}
        internships = list(db.internships.find(query))
        total_internships = len(internships)
        active_internships = sum(1 for i in internships if (i.get('status') or '').lower() == 'active')
        pending_internships = sum(1 for i in internships if (i.get('status') or '').lower() in ('pending approval', 'pending'))

        # applications for this company
        app_query = {'company': company}
        total_applications = db.applications.count_documents(app_query)
        selected_count = db.applications.count_documents({'company': company, 'status': 'Selected'})
        in_review_count = db.applications.count_documents({'company': company, 'status': {'$in': ['In Review', 'Pending', None]}})
        rejected_count = db.applications.count_documents({'company': company, 'status': 'Rejected'})

        res = {
            'company': company,
            'totalInternships': total_internships,
            'activeInternships': active_internships,
            'pendingInternships': pending_internships,
            'totalApplications': total_applications,
            'applicationStatusCounts': {
                'selected': selected_count,
                'inReview': in_review_count,
                'rejected': rejected_count,
                'total': total_applications
            }
        }
        return jsonify(res), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500
    

@app.route('/api/companies/by-email', methods=['GET'])
def get_company_by_email():
    email = request.args.get('email')
    if not email:
        return jsonify({'msg': 'Missing email parameter'}), 400
    try:
        doc = db.companies.find_one({'email': email})
        if not doc:
            return jsonify({'msg': 'Not found'}), 404
        doc['id'] = str(doc.pop('_id'))
        serialize_doc(doc)
        return jsonify({'company': doc}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500


@app.route('/api/company/verify', methods=['POST'])
def request_company_verification():
    """Accept multipart/form-data (document file) or JSON. Save uploaded file to backend/uploads and store full URL in company doc."""
    try:
        # support form-data or JSON
        email = None
        linkedin = None
        document_url = None
        if request.content_type and request.content_type.startswith('multipart/'):
            email = request.form.get('email')
            linkedin = request.form.get('linkedin')
            file = request.files.get('document')
            if file:
                uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
                os.makedirs(uploads_dir, exist_ok=True)
                filename = secure_filename(file.filename) or f'doc_{int(time.time())}'
                filename = f"{int(time.time())}_{filename}"
                save_path = os.path.join(uploads_dir, filename)
                file.save(save_path)
                document_url = request.host_url.rstrip('/') + f'/uploads/{filename}'
        else:
            data = request.json or {}
            email = data.get('email')
            linkedin = data.get('linkedin')
            document_url = data.get('documentUrl')

        if not email or not linkedin:
            return jsonify({'msg': 'Missing email or linkedin'}), 400

        now = __import__('datetime').datetime.utcnow().isoformat()
        update = {
            'linkedin': linkedin,
            'verificationStatus': 'Pending',
            'verificationRequestedAt': now
        }
        if document_url:
            update['verificationDocumentUrl'] = document_url

        res = db.companies.update_one({'email': email}, {'$set': update}, upsert=False)
        if res.matched_count == 0:
            res2 = db.users.update_one({'email': email}, {'$set': update}, upsert=False)
            if res2.matched_count == 0:
                return jsonify({'msg': 'Company not found'}), 404

        return jsonify({'msg': 'Verification requested', 'email': email}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500


@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    try:
        return send_from_directory(uploads_dir, filename, as_attachment=False)
    except Exception as e:
        return jsonify({'msg': 'Not found', 'error': str(e)}), 404

# New: get resume metadata by email. Returns {'resume': { ... }} or 404.
@app.route('/api/resume', methods=['GET'])
def get_resume_by_email():
    email = request.args.get('email')
    if not email:
        return jsonify({'msg': 'Missing email parameter'}), 400
    try:
        doc = db.resumes.find_one({'email': email})
        if not doc:
            return jsonify({'msg': 'Not found'}), 404
        # convert ObjectId and nested types
        doc['id'] = str(doc.pop('_id')) if doc.get('_id') else doc.get('id')
        serialize_doc(doc)
        return jsonify({'resume': doc}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

# Explicitly handle preflight for upload endpoint in case automatic handling misses it
@app.route('/api/upload_resume', methods=['OPTIONS'])
def upload_resume_options():
    resp = make_response('', 204)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, DELETE, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return resp


@app.route('/api/admin/verifications', methods=['GET'])
def admin_list_verifications():
    try:
        docs = list(db.companies.find({'verificationStatus': 'Pending'}))
        out = []
        for d in docs:
            safe = serialize_doc({k: v for k, v in d.items()})
            if safe.get('_id'):
                safe['id'] = str(safe.pop('_id'))
            # map representative fields for frontend convenience
            out.append({
                'id': safe.get('id') or safe.get('email'),
                'companyName': safe.get('companyName') or safe.get('company') or safe.get('name'),
                'representative': safe.get('fullName') or safe.get('representative') or '',
                'email': safe.get('email'),
                'verificationRequestedAt': safe.get('verificationRequestedAt'),
                'verificationDocumentUrl': safe.get('verificationDocumentUrl'),
                'linkedin': safe.get('linkedin'),
                'verificationStatus': safe.get('verificationStatus')
            })
        return jsonify({'verifications': out}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500


@app.route('/api/admin/verifications/<company_id>/<action>', methods=['POST'])
def admin_process_verification(company_id, action):
    if action not in ('approve', 'reject'):
        return jsonify({'msg': 'Invalid action'}), 400
    try:
        # try treat company_id as ObjectId
        query = None
        try:
            oid = ObjectId(company_id)
            query = {'_id': oid}
        except Exception:
            # fallback: match by email or id string
            query = {'$or': [{'email': company_id}, {'id': company_id}]}
        new_status = 'Verified' if action == 'approve' else 'Rejected'
        now = __import__('datetime').datetime.utcnow().isoformat()
        update = {'verificationStatus': new_status, 'verificationReviewedAt': now}
        res = db.companies.update_one(query, {'$set': update})
        if res.matched_count == 0:
            return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'OK', 'status': new_status}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500


@app.route('/api/users/by-email', methods=['PUT'])
def update_user_by_email():
    data = request.json or {}
    email = data.get('email')
    if not email:
        return jsonify({'msg': 'Missing email'}), 400
    allowed = ['fullName', 'companyName', 'designation', 'phone', 'linkedin']
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        return jsonify({'msg': 'Nothing to update'}), 400
    try:
        res = db.companies.update_one({'email': email}, {'$set': update})
        if res.matched_count == 0:
            res2 = db.users.update_one({'email': email}, {'$set': update})
            if res2.matched_count == 0:
                return jsonify({'msg': 'Not found'}), 404
        # return the updated document from companies if present else users
        doc = db.companies.find_one({'email': email}) or db.users.find_one({'email': email})
        if not doc:
            return jsonify({'msg': 'Not found post-update'}), 404
        doc['id'] = str(doc.pop('_id'))
        serialize_doc(doc)
        return jsonify({'msg': 'Updated', 'user': doc}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

def enrich_application_with_user(doc: dict):
    """If application document lacks student profile fields, try to enrich from users collection by email."""
    try:
        if not isinstance(doc, dict):
            return doc
        student_email = doc.get('studentEmail') or doc.get('email')
        if not student_email:
            return doc
        user = db.users.find_one({'email': student_email})
        if not user:
            return doc
        # copy common fields if missing
        if not doc.get('studentName'):
            doc['studentName'] = user.get('fullName') or user.get('name')
        if not doc.get('studentEmail'):
            doc['studentEmail'] = user.get('email')
        if not doc.get('phone'):
            doc['phone'] = user.get('phone')
        if not doc.get('university'):
            doc['university'] = user.get('university')
        if not doc.get('course'):
            doc['course'] = user.get('course')
        if not doc.get('year'):
            doc['year'] = user.get('yearOfStudy') or user.get('year')
    except Exception:
        pass
    return doc

@app.route('/api/applications/<app_id>', methods=['DELETE'])
def delete_application(app_id):
    """Delete an application by id. Accepts either ObjectId hex string or raw string id."""
    try:
        # try to interpret as ObjectId
        try:
            oid = ObjectId(app_id)
            query = {'_id': oid}
        except Exception:
            # fallback: match by id field or string id
            query = {'$or': [{'_id': app_id}, {'id': app_id}]}
        res = db.applications.delete_one(query)
        if res.deleted_count == 0:
            # maybe it was stored with string _id; try matching by id field explicitly
            try:
                res2 = db.applications.delete_one({'id': app_id})
                if res2.deleted_count == 0:
                    return jsonify({'msg': 'Not found'}), 404
            except Exception:
                return jsonify({'msg': 'Not found'}), 404
        return jsonify({'msg': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

@app.route('/api/upload_resume', methods=['POST', 'OPTIONS'])
def upload_resume():
    """Accept multipart/form-data (file + email) or JSON with dataUrl. Save file to backend/uploads and store resume metadata in a separate `resumes` collection."""
    try:
        # multipart form upload
        if request.content_type and request.content_type.startswith('multipart/'):
            email = request.form.get('email')
            file = request.files.get('resume')
            if not email or not file:
                return jsonify({'msg': 'Missing email or file'}), 400

            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            os.makedirs(uploads_dir, exist_ok=True)
            filename = secure_filename(file.filename) or f'resume_{int(time.time())}'
            filename = f"{int(time.time())}_{filename}"
            save_path = os.path.join(uploads_dir, filename)
            file.save(save_path)
            url = request.host_url.rstrip('/') + f'/uploads/{filename}'

            # persist metadata in separate resumes collection (upsert by email)
            try:
                resume_doc = {
                    'email': email,
                    'resumeFilename': file.filename,
                    'storedFilename': filename,
                    'resumeUrl': url,
                    'uploadedAt': __import__('datetime').datetime.utcnow().isoformat()
                }
                db.resumes.update_one({'email': email}, {'$set': resume_doc}, upsert=True)
            except Exception:
                pass

            return jsonify({'msg': 'Uploaded', 'url': url}), 200

        # JSON/base64 upload fallback
        data = request.json or {}
        email = data.get('email')
        dataUrl = data.get('dataUrl') or data.get('data') or ''
        if not email or not dataUrl:
            return jsonify({'msg': 'Missing email or data'}), 400

        parts = dataUrl.split(',', 1)
        if len(parts) == 2 and parts[0].startswith('data:'):
            meta, b64 = parts
            try:
                blob = base64.b64decode(b64)
            except Exception:
                return jsonify({'msg': 'Invalid base64 data'}), 400

            ext = 'pdf'
            if 'officedocument' in meta or 'word' in meta:
                ext = 'docx'
            filename = f"{int(time.time())}_resume.{ext}"
            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            os.makedirs(uploads_dir, exist_ok=True)
            save_path = os.path.join(uploads_dir, filename)
            with open(save_path, 'wb') as fh:
                fh.write(blob)
            url = request.host_url.rstrip('/') + f'/uploads/{filename}'
            try:
                resume_doc = {
                    'email': email,
                    'resumeFilename': filename,
                    'storedFilename': filename,
                    'resumeUrl': url,
                    'uploadedAt': __import__('datetime').datetime.utcnow().isoformat()
                }
                db.resumes.update_one({'email': email}, {'$set': resume_doc}, upsert=True)
            except Exception:
                pass
            return jsonify({'msg': 'Uploaded', 'url': url}), 200

        return jsonify({'msg': 'Unsupported data format'}), 400
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500


@app.route('/api/upload_resume', methods=['DELETE', 'OPTIONS'])
def delete_resume():
    """Delete stored resume file (if present) and remove resume metadata from the `resumes` collection."""
    try:
        data = request.json or {}
        email = data.get('email')
        if not email:
            return jsonify({'msg': 'Missing email'}), 400

        # find resume metadata in resumes collection
        res_doc = db.resumes.find_one({'email': email})
        if not res_doc:
            return jsonify({'msg': 'Not found'}), 404

        url = res_doc.get('resumeUrl')
        filename = None
        if url and '/uploads/' in url:
            filename = url.split('/uploads/')[-1]

        if filename:
            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            path = os.path.join(uploads_dir, filename)
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass

        # remove metadata document
        db.resumes.delete_one({'email': email})
        return jsonify({'msg': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'msg': 'Error', 'error': str(e)}), 500

if __name__ == '__main__':
    # Allow running the server directly: python backend/app.py
    # On Windows the auto-reloader can sometimes trigger socket errors (WinError 10038).
    # Disable the reloader in development to avoid the "not a socket" exception while still keeping debug logging.
    # Print registered routes for debugging preflight/route issues
    try:
        print("Registered routes:")
        for rule in app.url_map.iter_rules():
            print(f"{rule.methods} -> {rule}")
    except Exception:
        pass
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)

